import { getProcessEnv } from "env/process-env";
import { createLogger, format, transports } from "winston";

export const logger = createLogger({
	level: getProcessEnv("LOG_LEVEL") ?? "info",
	format: format.combine(
		format.timestamp(),
		format.errors({ stack: true }),
		format.json(),
	),
	transports: [
		new transports.Console({
			format: format.combine(format.colorize(), format.simple()),
		}),
	],
});
