import { init } from "@sentry/nextjs";
import { getProcessEnv } from "env/process-env";

if (getProcessEnv("NEXT_PUBLIC_SENTRY_DSN")) {
	init({
		dsn: getProcessEnv("NEXT_PUBLIC_SENTRY_DSN"),
		tracesSampleRate: 0.1,
		replaysSessionSampleRate: 0,
		replaysOnErrorSampleRate: 1.0,
		environment: getProcessEnv("NODE_ENV"),
	});
}
