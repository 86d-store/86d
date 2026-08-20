import { z } from "zod";

/** Result of uploading a file to storage. */
export interface StorageUploadResult {
	/** Public URL of the uploaded file. */
	url: string;
	/** Storage-specific key/path for the file. */
	key: string;
}

/** Options for uploading a file. */
export interface StorageUploadOptions {
	/** The key/path to store the file under. */
	key: string;
	/** File content as a Buffer or ArrayBuffer. */
	content: Buffer | ArrayBuffer;
	/** MIME content type. */
	contentType: string;
	/** Whether the file should be publicly readable. Default: true. */
	public?: boolean;
}

/** Options for deleting a file. */
export interface StorageDeleteOptions {
	/** The key/path or URL of the file to delete. */
	key: string;
}

/** Storage provider interface — all backends implement this. */
export interface StorageProvider {
	/** Upload a file to storage. */
	upload(options: StorageUploadOptions): Promise<StorageUploadResult>;
	/** Delete a file from storage. */
	delete(options: StorageDeleteOptions): Promise<void>;
	/** Get a public URL for a stored file. */
	getUrl(key: string): string;
	/** Check if the storage backend is available. */
	healthCheck(): Promise<boolean>;
}

export const storageConfigSchema = z.object({
	provider: z.enum(["local", "vercel", "s3"]).default("local"),
	/** Base directory for local storage. Default: ./uploads */
	localDir: z.string().optional().default("./uploads"),
	/** Base URL for serving local files. Default: /uploads */
	localBaseUrl: z.string().optional().default("/uploads"),
	/** S3 endpoint URL (for MinIO or other S3-compatible). */
	s3Endpoint: z.string().optional(),
	/** S3 bucket name. */
	s3Bucket: z.string().optional(),
	/** S3 region. */
	s3Region: z.string().optional().default("us-east-1"),
	/** S3 access key. */
	s3AccessKey: z.string().optional(),
	/** S3 secret key. */
	s3SecretKey: z.string().optional(),
	/** Use virtual-hosted URLs (Railway Bucket, AWS). */
	s3VirtualHosted: z.boolean().optional().default(false),
});

export type StorageConfig = z.infer<typeof storageConfigSchema>;
