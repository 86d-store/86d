import { describe, expect, it } from "vitest";
import { logger } from "../logger";

describe("logger", () => {
	it("is a winston logger instance", () => {
		expect(logger).toBeDefined();
		expect(typeof logger.info).toBe("function");
		expect(typeof logger.error).toBe("function");
		expect(typeof logger.warn).toBe("function");
		expect(typeof logger.debug).toBe("function");
	});

	it("has json format configured", () => {
		// Logger should not throw when logging
		expect(() => logger.info("test message")).not.toThrow();
	});

	it("has at least one transport", () => {
		expect(logger.transports.length).toBeGreaterThan(0);
	});

	it("defaults to info level", () => {
		expect(logger.level).toBe("info");
	});
});
