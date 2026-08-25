import { env as nodeProcessEnv } from "node:process";
import { createWorkloadIdentityProofBridge } from "@86d-app/sdk/workload-identity-proof";
import { readManagedWorkloadConfig } from "@86d-app/sdk/workload-token-client";
import { type NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "utils/rate-limit";

const proofLimiter = createRateLimiter({ limit: 10, window: 60_000 });
const challengePattern = /^[A-Za-z0-9_-]{43}$/;

type ManagedConfig = NonNullable<ReturnType<typeof readManagedWorkloadConfig>>;
let proofBridge:
	| ReturnType<typeof createWorkloadIdentityProofBridge>
	| undefined;
let proofBridgeConfig: ManagedConfig | undefined;

function status(value: string, httpStatus: number) {
	return NextResponse.json({ status: value }, { status: httpStatus });
}

function bridgeFor(config: ManagedConfig) {
	if (
		!proofBridge ||
		!proofBridgeConfig ||
		proofBridgeConfig.storeId !== config.storeId ||
		proofBridgeConfig.apiBaseUrl !== config.apiBaseUrl ||
		proofBridgeConfig.credential !== config.credential
	) {
		proofBridge = createWorkloadIdentityProofBridge({ config });
		proofBridgeConfig = config;
	}
	return proofBridge;
}

export async function POST(request: NextRequest) {
	const ip =
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
	if (!proofLimiter.check(ip).allowed) {
		return status("rate_limited", 429);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return status("invalid_request", 400);
	}
	if (
		!body ||
		typeof body !== "object" ||
		Array.isArray(body) ||
		Object.keys(body).length !== 1 ||
		typeof (body as { challenge?: unknown }).challenge !== "string" ||
		!challengePattern.test((body as { challenge: string }).challenge)
	) {
		return status("invalid_request", 400);
	}

	let config: ReturnType<typeof readManagedWorkloadConfig>;
	try {
		// Pass the live Node env explicitly so Next standalone bundling cannot
		// hide Railway-injected managed identity variables.
		config = readManagedWorkloadConfig(nodeProcessEnv);
	} catch {
		return status("unavailable", 503);
	}
	if (!config) {
		return status("unavailable", 503);
	}

	try {
		await bridgeFor(config).prove({
			challenge: (body as { challenge: string }).challenge,
		});
		return status("ok", 200);
	} catch {
		return status("failed", 502);
	}
}
