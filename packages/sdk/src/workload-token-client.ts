import { Buffer } from "node:buffer";

export interface ManagedWorkloadConfig {
	storeId: string;
	apiBaseUrl: string;
	credential: string;
}

export interface WorkloadTokenResource {
	audience: string;
	scopes: readonly string[];
}

export interface WorkloadTokenClient {
	readonly configured: boolean;
	getToken(resource: WorkloadTokenResource): Promise<string>;
	request(
		resource: WorkloadTokenResource,
		input: string | URL | Request,
		init?: RequestInit,
	): Promise<Response>;
}

export interface CreateWorkloadTokenClientOptions {
	config: ManagedWorkloadConfig | undefined;
	fetch?: typeof globalThis.fetch;
}

const STORE_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateManagedWorkloadConfig(
	config: ManagedWorkloadConfig,
): ManagedWorkloadConfig {
	let apiUrl: URL;
	try {
		apiUrl = new URL(config.apiBaseUrl);
	} catch {
		throw new Error("Managed workload configuration is invalid");
	}
	if (
		!STORE_ID_PATTERN.test(config.storeId) ||
		apiUrl.protocol !== "https:" ||
		apiUrl.username.length > 0 ||
		apiUrl.password.length > 0 ||
		apiUrl.search.length > 0 ||
		apiUrl.hash.length > 0
	) {
		throw new Error("Managed workload configuration is invalid");
	}
	parseCredential(config.credential);
	return config;
}

export function readManagedWorkloadConfig(
	environment: Record<string, string | undefined> = process.env,
): ManagedWorkloadConfig | undefined {
	const storeId = environment["86D_STORE_ID"];
	const apiBaseUrl = environment["86D_API_URL"];
	const credential = environment["86D_WORKLOAD_CREDENTIAL"];
	if (!storeId && !credential) {
		return undefined;
	}
	if (!storeId || !apiBaseUrl || !credential) {
		throw new Error("Managed workload configuration is incomplete");
	}
	return validateManagedWorkloadConfig({ storeId, apiBaseUrl, credential });
}

interface ParsedCredential {
	clientId: string;
	secret: string;
}

interface CachedToken {
	accessToken: string;
	refreshAt: number;
}

const REFRESH_SKEW_MS = 30_000;
const MAX_TOKEN_TTL_SECONDS = 600;
const TOKEN_EXCHANGE_ERROR = "Managed workload token exchange failed";

function controlPlaneApiRoot(apiBaseUrl: string): URL {
	const root = new URL(apiBaseUrl);
	const path = root.pathname.replace(/\/+$/, "");
	root.pathname = `${path.endsWith("/api") ? path : `${path}/api`}/`;
	return root;
}

function normalizeResource(resource: WorkloadTokenResource) {
	let audience: URL;
	try {
		audience = new URL(resource.audience);
	} catch {
		throw new Error("Managed workload token resource is invalid");
	}
	if (
		resource.audience.length > 2_048 ||
		audience.protocol !== "https:" ||
		audience.username.length > 0 ||
		audience.password.length > 0 ||
		audience.search.length > 0 ||
		audience.hash.length > 0 ||
		resource.scopes.length === 0 ||
		resource.scopes.length > 32 ||
		resource.scopes.some((scope) => {
			const match = /[a-z][a-z0-9._-]{0,127}:[a-z][a-z0-9._-]{0,63}/.exec(
				scope,
			);
			return match?.[0] !== scope;
		})
	) {
		throw new Error("Managed workload token resource is invalid");
	}
	const scopes = [...new Set(resource.scopes)].sort();
	return {
		audience: resource.audience,
		scopes,
		cacheKey: `${resource.audience}\n${scopes.join(" ")}`,
	};
}

function isInvalidTokenChallenge(response: Response): boolean {
	if (response.status !== 401) {
		return false;
	}
	const challenge = response.headers.get("WWW-Authenticate");
	return (
		challenge !== null &&
		/^Bearer\b/i.test(challenge.trim()) &&
		/\berror\s*=\s*"invalid_token"/i.test(challenge)
	);
}

function resolveRequestInput(
	config: ManagedWorkloadConfig,
	input: string | URL | Request,
): string | URL | Request {
	const base = controlPlaneApiRoot(config.apiBaseUrl);
	let target: URL;
	try {
		target = new URL(
			input instanceof Request ? input.url : input.toString(),
			base,
		);
	} catch {
		throw new Error("Managed workload request target is invalid");
	}
	const basePath = base.pathname.endsWith("/")
		? base.pathname
		: `${base.pathname}/`;
	if (
		target.origin !== base.origin ||
		target.username.length > 0 ||
		target.password.length > 0 ||
		(target.pathname !== base.pathname.replace(/\/$/, "") &&
			!target.pathname.startsWith(basePath))
	) {
		throw new Error("Managed workload request target is invalid");
	}
	return input instanceof Request ? input : target;
}

function parseCredential(credential: string): ParsedCredential {
	const match = /^86d_wc_([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/.exec(
		credential,
	);
	if (!match) {
		throw new Error("Managed workload configuration is invalid");
	}
	return { clientId: `86d_wc_${match[1] ?? ""}`, secret: match[2] ?? "" };
}

export function createWorkloadTokenClient(
	options: CreateWorkloadTokenClientOptions,
): WorkloadTokenClient {
	const config = options.config
		? validateManagedWorkloadConfig(options.config)
		: undefined;
	const cache = new Map<string, CachedToken>();
	const inFlight = new Map<string, Promise<string>>();
	const client: WorkloadTokenClient = {
		configured: config !== undefined,
		async getToken(resource) {
			if (!config) {
				throw new Error("Managed workload identity is not configured");
			}
			const credential = parseCredential(config.credential);
			const normalized = normalizeResource(resource);
			const { cacheKey, scopes } = normalized;
			const cached = cache.get(cacheKey);
			if (cached && Date.now() < cached.refreshAt) {
				return cached.accessToken;
			}
			const pending = inFlight.get(cacheKey);
			if (pending) {
				return pending;
			}
			const exchange = (async () => {
				const body = new URLSearchParams({
					grant_type: "client_credentials",
					resource: normalized.audience,
					scope: scopes.join(" "),
				});
				const fetch = options.fetch ?? globalThis.fetch;
				let response: Response;
				try {
					response = await fetch(
						new URL(
							"oauth/token",
							controlPlaneApiRoot(config.apiBaseUrl),
						).toString(),
						{
							method: "POST",
							headers: {
								Authorization: `Basic ${Buffer.from(`${credential.clientId}:${credential.secret}`).toString("base64")}`,
								"Content-Type": "application/x-www-form-urlencoded",
							},
							body: body.toString(),
						},
					);
				} catch {
					throw new Error(TOKEN_EXCHANGE_ERROR);
				}
				if (!response.ok) {
					throw new Error(TOKEN_EXCHANGE_ERROR);
				}
				let payload: Record<string, unknown>;
				try {
					const json = (await response.json()) as unknown;
					if (!json || typeof json !== "object" || Array.isArray(json)) {
						throw new Error(TOKEN_EXCHANGE_ERROR);
					}
					payload = json as Record<string, unknown>;
				} catch {
					throw new Error(TOKEN_EXCHANGE_ERROR);
				}
				const returnedScopes =
					typeof payload.scope === "string"
						? [
								...new Set(payload.scope.trim().split(/\s+/).filter(Boolean)),
							].sort()
						: [];
				const accessTokenMatch =
					typeof payload.access_token === "string"
						? /[A-Za-z0-9\-._~+/]+=*/.exec(payload.access_token)
						: null;
				if (
					typeof payload.access_token !== "string" ||
					payload.access_token.length === 0 ||
					payload.access_token.length > 16_384 ||
					accessTokenMatch?.[0] !== payload.access_token ||
					!/^Bearer$/i.test(String(payload.token_type)) ||
					typeof payload.expires_in !== "number" ||
					!Number.isInteger(payload.expires_in) ||
					payload.expires_in <= 0 ||
					payload.expires_in > MAX_TOKEN_TTL_SECONDS ||
					returnedScopes.join(" ") !== scopes.join(" ") ||
					"refresh_token" in payload
				) {
					throw new Error(TOKEN_EXCHANGE_ERROR);
				}
				cache.set(cacheKey, {
					accessToken: payload.access_token,
					refreshAt:
						Date.now() +
						Math.max(0, payload.expires_in * 1000 - REFRESH_SKEW_MS),
				});
				return payload.access_token;
			})();
			inFlight.set(cacheKey, exchange);
			try {
				return await exchange;
			} finally {
				if (inFlight.get(cacheKey) === exchange) {
					inFlight.delete(cacheKey);
				}
			}
		},
		async request(resource, input, init) {
			if (!config) {
				throw new Error("Managed workload identity is not configured");
			}
			const requestInput = resolveRequestInput(config, input);
			const normalized = normalizeResource(resource);
			const fetch = options.fetch ?? globalThis.fetch;
			const execute = async (token: string) => {
				const headers = new Headers(
					init?.headers ??
						(input instanceof Request ? input.headers : undefined),
				);
				headers.set("Authorization", `Bearer ${token}`);
				try {
					// Each dispatch needs its own body stream. A Request passed directly to
					// fetch is consumed by the first attempt and cannot be reused after a
					// valid invalid_token challenge.
					const attemptInput =
						requestInput instanceof Request
							? requestInput.clone()
							: requestInput;
					return await fetch(attemptInput, { ...init, headers });
				} catch {
					throw new Error("Managed workload request failed");
				}
			};
			const attemptedToken = await client.getToken(resource);
			const first = await execute(attemptedToken);
			if (!isInvalidTokenChallenge(first)) {
				return first;
			}
			if (cache.get(normalized.cacheKey)?.accessToken === attemptedToken) {
				cache.delete(normalized.cacheKey);
			}
			return execute(await client.getToken(resource));
		},
	};
	return client;
}
