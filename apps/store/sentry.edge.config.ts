import { init } from "@sentry/nextjs";
import { getProcessEnv } from "env/process-env";

if (getProcessEnv("SENTRY_DSN")) {
	init({
		dsn: getProcessEnv("SENTRY_DSN"),
		tracesSampleRate: 0.1,
		environment: getProcessEnv("NODE_ENV"),
	});
}
