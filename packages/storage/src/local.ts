import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
	StorageDeleteOptions,
	StorageProvider,
	StorageUploadOptions,
	StorageUploadResult,
} from "./types.ts";

export class LocalStorageProvider implements StorageProvider {
	private readonly baseDir: string;
	private readonly baseUrl: string;

	constructor(baseDir: string, baseUrl: string) {
		this.baseDir = resolve(baseDir);
		this.baseUrl = baseUrl.replace(/\/$/, "");
		// Ensure base directory exists
		if (!existsSync(this.baseDir)) {
			mkdirSync(this.baseDir, { recursive: true });
		}
	}

	private resolveAndValidate(key: string): string {
		const filePath = resolve(join(this.baseDir, key));
		if (!filePath.startsWith(this.baseDir)) {
			throw new Error("Invalid storage key: path traversal detected");
		}
		return filePath;
	}

	async upload(options: StorageUploadOptions): Promise<StorageUploadResult> {
		const filePath = this.resolveAndValidate(options.key);
		const dir = dirname(filePath);
		mkdirSync(dir, { recursive: true });
		const buffer =
			options.content instanceof ArrayBuffer
				? Buffer.from(options.content)
				: options.content;
		writeFileSync(filePath, buffer);
		return {
			url: `${this.baseUrl}/${options.key}`,
			key: options.key,
		};
	}

	async delete(options: StorageDeleteOptions): Promise<void> {
		const filePath = this.resolveAndValidate(options.key);
		try {
			unlinkSync(filePath);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
		}
	}

	getUrl(key: string): string {
		return `${this.baseUrl}/${key}`;
	}

	async healthCheck(): Promise<boolean> {
		return existsSync(this.baseDir);
	}
}
