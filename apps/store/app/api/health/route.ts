import { db } from "db";
import { type NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "utils/rate-limit";
import { getStorage } from "~/lib/storage";

const healthLimiter = createRateLimiter({ limit: 60, window: 60_000 });

/**
 * Health check endpoint for container readiness probes.
 *
 * Returns 200 if the app and database are reachable.
 * Returns 503 if critical services (database) are down.
 * Storage failures degrade to a warning but don't fail the probe,
 * since the store can still serve pages without uploads.
 */
export async function GET(request: NextRequest) {
	const ip =
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
	if (!healthLimiter.check(ip).allowed) {
		return new NextResponse(null, { status: 429 });
	}

	const checks: Record<string, "ok" | "error"> = {
		app: "ok",
		database: "error",
		storage: "error",
	};

	// Database — critical (503 if down)
	try {
		await db.$queryRaw`SELECT 1`;
		checks.database = "ok";
	} catch {
		checks.database = "error";
	}

	// Storage — non-critical (store works without uploads)
	try {
		const storage = getStorage();
		const storageOk = await storage.healthCheck();
		checks.storage = storageOk ? "ok" : "error";
	} catch {
		checks.storage = "error";
	}

	// Critical checks determine the HTTP status
	const critical = checks.database === "ok";
	const allOk = Object.values(checks).every((v) => v === "ok");

	return NextResponse.json(
		{
			status: allOk ? "healthy" : critical ? "degraded" : "unhealthy",
			checks,
			timestamp: new Date().toISOString(),
		},
		{ status: critical ? 200 : 503 },
	);
}
