import {
	createWorkloadTokenClient,
	type ManagedWorkloadConfig,
	type WorkloadTokenClient,
} from "./workload-token-client";

export interface WorkloadIdentityProofBridge {
	prove(input: { challenge: string }): Promise<{ status: "ok" }>;
}

function trimTrailingSlashes(value: string): string {
	let out = value;
	while (out.endsWith("/")) {
		out = out.slice(0, -1);
	}
	return out;
}

export function createWorkloadIdentityProofBridge(input: {
	config: ManagedWorkloadConfig;
	client?: WorkloadTokenClient | undefined;
	fetch?: typeof globalThis.fetch | undefined;
}): WorkloadIdentityProofBridge {
	const client =
		input.client ??
		createWorkloadTokenClient({
			config: input.config,
			...(input.fetch ? { fetch: input.fetch } : {}),
		});
	const fetch = input.fetch ?? globalThis.fetch;
	const apiBase = trimTrailingSlashes(input.config.apiBaseUrl);
	const apiRoot = apiBase.endsWith("/api") ? apiBase : `${apiBase}/api`;
	return {
		async prove(proof) {
			if (!/^[A-Za-z0-9_-]{43}$/.test(proof.challenge)) {
				throw new Error("Managed workload identity proof request is invalid");
			}
			try {
				const preflight = await fetch(
					`${apiRoot}/v1/workloads/proof-challenges/validate`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							challenge: proof.challenge,
							storeId: input.config.storeId,
							runtimeEnvironment: "production",
						}),
						cache: "no-store",
						redirect: "error",
					},
				);
				if (!preflight.ok) {
					throw new Error("invalid proof challenge");
				}
				const body = (await preflight.json()) as unknown;
				if (
					!body ||
					typeof body !== "object" ||
					Array.isArray(body) ||
					Object.keys(body).length !== 1 ||
					(body as { status?: unknown }).status !== "valid"
				) {
					throw new Error("invalid proof challenge");
				}
			} catch {
				throw new Error("Managed workload identity proof failed");
			}
			let response: Response;
			try {
				response = await client.request(
					{
						audience: "https://86d.app/api/store-runtime",
						scopes: ["runtime.health:read"],
					},
					"v1/workloads/proof",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ challenge: proof.challenge }),
					},
				);
			} catch {
				throw new Error("Managed workload identity proof failed");
			}
			if (!response.ok) {
				throw new Error("Managed workload identity proof failed");
			}
			let body: unknown;
			try {
				body = await response.json();
			} catch {
				throw new Error("Managed workload identity proof failed");
			}
			if (
				!body ||
				typeof body !== "object" ||
				Array.isArray(body) ||
				Object.keys(body).length !== 1 ||
				(body as { status?: unknown }).status !== "ok"
			) {
				throw new Error("Managed workload identity proof failed");
			}
			return { status: "ok" };
		},
	};
}
