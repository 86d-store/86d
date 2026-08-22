import { captureRequestError } from "@sentry/nextjs";
import { getProcessEnv } from "env/process-env";

export const onRequestError = captureRequestError;

export async function register() {
	if (getProcessEnv("NEXT_RUNTIME") === "nodejs") {
		await import("./sentry.server.config");
	}

	if (getProcessEnv("NEXT_RUNTIME") === "edge") {
		await import("./sentry.edge.config");
	}
}
