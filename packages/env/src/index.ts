import { z } from "zod";
import { readProcessEnv } from "./process-env";

const LOCAL_BETTER_AUTH_SECRET =
	"86d-local-development-only-better-auth-secret";
const KNOWN_AUTH_SECRET_PLACEHOLDERS = new Set([
	"better-auth-secret-12345678901234567890",
	"docker-dev-secret-change-in-production",
]);
const MINIMUM_AUTH_SECRET_ENTROPY_BITS = 120;

function estimateSecretEntropyBits(secret: string): number {
	const uniqueCharacters = new Set(secret).size;
	return uniqueCharacters === 0
		? 0
		: secret.length * Math.log2(uniqueCharacters);
}

/**
 * Resolve whether a candidate auth secret is safe to enable Better Auth.
 * Missing or production-unsafe values disable auth rather than failing boot
 * or build — no environment variables are required to start the Store.
 */
export function resolveBetterAuthSecret(
	secret: string | undefined,
	nodeEnv: ParsedEnv["NODE_ENV"],
): string | undefined {
	if (!secret) return undefined;

	if (nodeEnv !== "production") {
		return secret;
	}

	if (secret.length < 32) {
		console.warn(
			"BETTER_AUTH_SECRET is shorter than 32 characters; authentication is disabled.",
		);
		return undefined;
	}
	if (secret === LOCAL_BETTER_AUTH_SECRET) {
		console.warn(
			"BETTER_AUTH_SECRET uses the local-only development value; authentication is disabled.",
		);
		return undefined;
	}
	if (KNOWN_AUTH_SECRET_PLACEHOLDERS.has(secret)) {
		console.warn(
			"BETTER_AUTH_SECRET uses a known placeholder; authentication is disabled.",
		);
		return undefined;
	}
	if (estimateSecretEntropyBits(secret) < MINIMUM_AUTH_SECRET_ENTROPY_BITS) {
		console.warn(
			"BETTER_AUTH_SECRET has unacceptably low entropy; authentication is disabled.",
		);
		return undefined;
	}

	return secret;
}

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	STORE_ID: z
		.string()
		.optional()
		.transform((v) => v || "de005b9d-c517-4c65-896e-8edef5cf5a94"),
	"86D_API_URL": z.url().optional().default("https://api.86d.app"),
	"86D_STORE_ID": z.string().uuid().optional(),
	"86D_WORKLOAD_CREDENTIAL": z.string().optional(),
	"86D_TELEMETRY": z.literal("managed-runtime-diagnostics-v1").optional(),
	"86D_ADMIN_OAUTH_CLIENT_ID": z.string().optional(),
	"86D_ADMIN_OAUTH_CLIENT_SECRET": z.string().optional(),
	DATABASE_URL: z.string().optional(),
	NEXT_PUBLIC_STORE_URL: z.url().optional(),
	NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID: z.string().optional(),
	SENTRY_DSN: z.string().optional(),
	NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
	VERCEL_BLOB_STORAGE_HOSTNAME: z.string().optional(),
	STORAGE_CLIENT: z.enum(["local", "vercel", "s3"]).optional().default("local"),
	STORAGE_LOCAL_DIR: z.string().optional(),
	STORAGE_LOCAL_BASE_URL: z.string().optional(),
	GA4_MEASUREMENT_ID: z.string().optional(),
	GA4_API_SECRET: z.string().optional(),
	RESEND_API_KEY: z.string().optional(),
	BETTER_AUTH_SECRET: z.string().optional(),
	/**
	 * Proxy hops between the shopper and this process. Rate limiting reads the
	 * hop our own edge appended rather than the leftmost `x-forwarded-for`
	 * entry, which the client controls.
	 */
	TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).default(1),
});

type ParsedEnv = z.infer<typeof envSchema>;
export type Env = Omit<ParsedEnv, "BETTER_AUTH_SECRET"> & {
	/** Present only when auth is enabled; otherwise authentication is disabled. */
	BETTER_AUTH_SECRET: string | undefined;
};

export function parseEnvironment(
	environment: Record<string, string | undefined>,
): Env {
	const parsed = envSchema.safeParse({
		...environment,
		// Managed Runtime identity is canonical at boot. Standalone installs retain
		// the historical STORE_ID boundary and its local default.
		STORE_ID: environment["86D_STORE_ID"] ?? environment.STORE_ID,
	});

	if (!parsed.success) {
		console.error(
			"Invalid environment variables:",
			parsed.error.flatten().fieldErrors,
		);
		throw new Error("Invalid environment variables");
	}

	return {
		...parsed.data,
		BETTER_AUTH_SECRET: resolveBetterAuthSecret(
			parsed.data.BETTER_AUTH_SECRET,
			parsed.data.NODE_ENV,
		),
	};
}

const env = parseEnvironment(readProcessEnv());

export default env;
