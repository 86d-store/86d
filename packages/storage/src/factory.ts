import { LocalStorageProvider } from "./local.ts";
import { S3StorageProvider } from "./s3.ts";
import type { StorageConfig, StorageProvider } from "./types.ts";
import { VercelBlobProvider } from "./vercel.ts";

/** Create a storage provider from configuration. */
export function createStorage(config: StorageConfig): StorageProvider {
	switch (config.provider) {
		case "local":
			return new LocalStorageProvider(
				config.localDir ?? "./uploads",
				config.localBaseUrl ?? "/uploads",
			);
		case "vercel":
			return new VercelBlobProvider();
		case "s3": {
			if (
				!config.s3Endpoint ||
				!config.s3Bucket ||
				!config.s3AccessKey ||
				!config.s3SecretKey
			) {
				throw new Error(
					"S3 storage requires s3Endpoint, s3Bucket, s3AccessKey, and s3SecretKey",
				);
			}
			return new S3StorageProvider({
				endpoint: config.s3Endpoint,
				bucket: config.s3Bucket,
				region: config.s3Region ?? "us-east-1",
				accessKey: config.s3AccessKey,
				secretKey: config.s3SecretKey,
				virtualHosted: config.s3VirtualHosted ?? false,
			});
		}
		default:
			throw new Error(`Unknown storage provider: ${String(config.provider)}`);
	}
}

/** Create a storage provider from environment variables. */
export function createStorageFromEnv(): StorageProvider {
	const provider = (process.env.STORAGE_CLIENT ?? "local") as
		| "local"
		| "vercel"
		| "s3";

	return createStorage({
		provider,
		localDir: process.env.STORAGE_LOCAL_DIR ?? "./uploads",
		localBaseUrl: process.env.STORAGE_LOCAL_BASE_URL ?? "/uploads",
		s3Endpoint: process.env.S3_ENDPOINT,
		s3Bucket: process.env.S3_BUCKET,
		s3Region: process.env.S3_REGION ?? "us-east-1",
		s3AccessKey: process.env.S3_ACCESS_KEY,
		s3SecretKey: process.env.S3_SECRET_KEY,
		s3VirtualHosted:
			process.env.S3_VIRTUAL_HOSTED_STYLE === "1" ||
			process.env.S3_VIRTUAL_HOSTED_STYLE === "true",
	});
}
