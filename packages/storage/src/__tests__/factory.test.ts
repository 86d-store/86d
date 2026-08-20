import { afterEach, describe, expect, it } from "vitest";
import { createStorage, createStorageFromEnv } from "../factory.ts";
import { LocalStorageProvider } from "../local.ts";
import { S3StorageProvider } from "../s3.ts";
import { storageConfigSchema } from "../types.ts";
import { VercelBlobProvider } from "../vercel.ts";

describe("createStorage", () => {
	it("creates LocalStorageProvider for 'local' provider", () => {
		const config = storageConfigSchema.parse({ provider: "local" });
		const storage = createStorage(config);
		expect(storage).toBeInstanceOf(LocalStorageProvider);
	});

	it("creates VercelBlobProvider for 'vercel' provider", () => {
		const config = storageConfigSchema.parse({ provider: "vercel" });
		const storage = createStorage(config);
		expect(storage).toBeInstanceOf(VercelBlobProvider);
	});

	it("creates S3StorageProvider with full config", () => {
		const config = storageConfigSchema.parse({
			provider: "s3",
			s3Endpoint: "https://s3.example.com",
			s3Bucket: "my-bucket",
			s3Region: "eu-west-1",
			s3AccessKey: "AKIA_TEST",
			s3SecretKey: "secret_test",
		});
		const storage = createStorage(config);
		expect(storage).toBeInstanceOf(S3StorageProvider);
	});

	it("throws when S3 config is incomplete", () => {
		const config = storageConfigSchema.parse({ provider: "s3" });
		expect(() => createStorage(config)).toThrow(
			"S3 storage requires s3Endpoint, s3Bucket, s3AccessKey, and s3SecretKey",
		);
	});

	it("throws when S3 is missing bucket", () => {
		const config = storageConfigSchema.parse({
			provider: "s3",
			s3Endpoint: "https://s3.example.com",
		});
		expect(() => createStorage(config)).toThrow("S3 storage requires");
	});

	it("uses default localDir and localBaseUrl for local provider", () => {
		const config = storageConfigSchema.parse({ provider: "local" });
		const storage = createStorage(config);
		expect(storage.getUrl("file.txt")).toBe("/uploads/file.txt");
	});

	it("uses custom localDir and localBaseUrl", () => {
		const config = storageConfigSchema.parse({
			provider: "local",
			localDir: "/tmp/test-custom",
			localBaseUrl: "/static",
		});
		const storage = createStorage(config);
		expect(storage.getUrl("file.txt")).toBe("/static/file.txt");
	});
});

describe("createStorageFromEnv", () => {
	const originalEnv = process.env;

	afterEach(() => {
		process.env = originalEnv;
	});

	it("defaults to local provider when STORAGE_CLIENT is not set", () => {
		process.env = { ...originalEnv };
		delete process.env.STORAGE_CLIENT;
		const storage = createStorageFromEnv();
		expect(storage).toBeInstanceOf(LocalStorageProvider);
	});

	it("creates local provider from env", () => {
		process.env = {
			...originalEnv,
			STORAGE_CLIENT: "local",
			STORAGE_LOCAL_DIR: "/tmp/test-env",
			STORAGE_LOCAL_BASE_URL: "/files",
		};
		const storage = createStorageFromEnv();
		expect(storage).toBeInstanceOf(LocalStorageProvider);
		expect(storage.getUrl("test.txt")).toBe("/files/test.txt");
	});

	it("creates vercel provider from env", () => {
		process.env = { ...originalEnv, STORAGE_CLIENT: "vercel" };
		const storage = createStorageFromEnv();
		expect(storage).toBeInstanceOf(VercelBlobProvider);
	});

	it("creates S3 provider from env", () => {
		process.env = {
			...originalEnv,
			STORAGE_CLIENT: "s3",
			S3_ENDPOINT: "https://minio.local:9000",
			S3_BUCKET: "store-uploads",
			S3_REGION: "us-west-2",
			S3_ACCESS_KEY: "minioadmin",
			S3_SECRET_KEY: "minioadmin",
		};
		const storage = createStorageFromEnv();
		expect(storage).toBeInstanceOf(S3StorageProvider);
	});

	it("throws when S3 env vars are missing", () => {
		process.env = { ...originalEnv, STORAGE_CLIENT: "s3" };
		expect(() => createStorageFromEnv()).toThrow("S3 storage requires");
	});
});
