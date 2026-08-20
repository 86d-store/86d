import { describe, expect, it } from "vitest";
import { storageConfigSchema } from "../types.ts";

describe("storageConfigSchema", () => {
	it("parses minimal config with defaults", () => {
		const result = storageConfigSchema.parse({});
		expect(result.provider).toBe("local");
		expect(result.localDir).toBe("./uploads");
		expect(result.localBaseUrl).toBe("/uploads");
		expect(result.s3Region).toBe("us-east-1");
	});

	it("parses local provider config", () => {
		const result = storageConfigSchema.parse({
			provider: "local",
			localDir: "/data/uploads",
			localBaseUrl: "/static/uploads",
		});
		expect(result.provider).toBe("local");
		expect(result.localDir).toBe("/data/uploads");
		expect(result.localBaseUrl).toBe("/static/uploads");
	});

	it("parses S3 provider config", () => {
		const result = storageConfigSchema.parse({
			provider: "s3",
			s3Endpoint: "https://s3.amazonaws.com",
			s3Bucket: "my-bucket",
			s3Region: "eu-west-1",
			s3AccessKey: "AKIA_TEST",
			s3SecretKey: "secret",
		});
		expect(result.provider).toBe("s3");
		expect(result.s3Endpoint).toBe("https://s3.amazonaws.com");
		expect(result.s3Bucket).toBe("my-bucket");
		expect(result.s3Region).toBe("eu-west-1");
	});

	it("parses vercel provider config", () => {
		const result = storageConfigSchema.parse({ provider: "vercel" });
		expect(result.provider).toBe("vercel");
	});

	it("rejects invalid provider", () => {
		expect(() => storageConfigSchema.parse({ provider: "azure" })).toThrow();
	});

	it("applies S3 region default", () => {
		const result = storageConfigSchema.parse({
			provider: "s3",
			s3Endpoint: "https://s3.example.com",
			s3Bucket: "bucket",
		});
		expect(result.s3Region).toBe("us-east-1");
	});
});
