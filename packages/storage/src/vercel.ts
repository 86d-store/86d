import { getProcessEnv } from "env/process-env";
import type {
	StorageDeleteOptions,
	StorageProvider,
	StorageUploadOptions,
	StorageUploadResult,
} from "./types.ts";

export class VercelBlobProvider implements StorageProvider {
	async upload(options: StorageUploadOptions): Promise<StorageUploadResult> {
		const { put } = await import("@vercel/blob");
		const buffer =
			options.content instanceof ArrayBuffer
				? Buffer.from(options.content)
				: options.content;
		const blob = await put(options.key, buffer, {
			access: "public",
			contentType: options.contentType,
		});
		return {
			url: blob.url,
			key: options.key,
		};
	}

	async delete(options: StorageDeleteOptions): Promise<void> {
		const { del } = await import("@vercel/blob");
		await del(options.key);
	}

	getUrl(key: string): string {
		// Vercel Blob URLs are returned from upload — this is a fallback
		const hostname = getProcessEnv("VERCEL_BLOB_STORAGE_HOSTNAME");
		if (hostname) {
			return `https://${hostname}/${key}`;
		}
		return key;
	}

	async healthCheck(): Promise<boolean> {
		return !!getProcessEnv("BLOB_READ_WRITE_TOKEN");
	}
}
