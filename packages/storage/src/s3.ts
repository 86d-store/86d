import { createHash, createHmac } from "node:crypto";
import type {
	StorageDeleteOptions,
	StorageProvider,
	StorageUploadOptions,
	StorageUploadResult,
} from "./types.ts";

interface S3Config {
	endpoint: string;
	bucket: string;
	region: string;
	accessKey: string;
	secretKey: string;
	/** Railway Bucket / AWS virtual-hosted: `https://{bucket}.{endpoint-host}/{key}` */
	virtualHosted?: boolean | undefined;
}

function encodeKeyPath(key: string): string {
	const parts = key.split("/").filter(Boolean);
	if (parts.length === 0) {
		return "/";
	}
	return `/${parts.map((p) => encodeURIComponent(p)).join("/")}`;
}

/** Minimal S3-compatible client using AWS Signature V4 and fetch. */
export class S3StorageProvider implements StorageProvider {
	private readonly config: S3Config;

	constructor(config: S3Config) {
		this.config = config;
	}

	private pathStyleObjectUrl(key: string): string {
		const base = `${this.config.endpoint.replace(/\/$/, "")}/${this.config.bucket}`;
		const path = encodeKeyPath(key);
		return `${base}${path === "/" ? "/" : path}`;
	}

	private virtualHostedObjectUrl(key: string): string {
		const endpointUrl = new URL(this.config.endpoint);
		const base = `https://${this.config.bucket}.${endpointUrl.host}`;
		const path = encodeKeyPath(key);
		return `${base}${path === "/" ? "/" : path}`;
	}

	private objectUrl(key: string): string {
		return this.config.virtualHosted
			? this.virtualHostedObjectUrl(key)
			: this.pathStyleObjectUrl(key);
	}

	/** Canonical URI (path only) for SigV4 — excludes query string. */
	private canonicalObjectPath(key: string): string {
		const path = encodeKeyPath(key);
		if (this.config.virtualHosted) {
			return path === "/" ? "/" : path;
		}
		return `/${this.config.bucket}${path === "/" ? "" : path}`;
	}

	private requestHost(): string {
		if (this.config.virtualHosted) {
			const endpointUrl = new URL(this.config.endpoint);
			return `${this.config.bucket}.${endpointUrl.host}`;
		}
		return new URL(this.config.endpoint).host;
	}

	private sign(
		method: string,
		canonicalPath: string,
		headers: Record<string, string>,
		payload: Buffer | null,
	): Record<string, string> {
		const { region, accessKey, secretKey } = this.config;
		const now = new Date();
		const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
		const amzDate = `${dateStamp}T${now.toISOString().replace(/[-:]/g, "").slice(9, 15)}Z`;
		const service = "s3";
		const scope = `${dateStamp}/${region}/${service}/aws4_request`;

		const payloadHash = createHash("sha256")
			.update(payload ?? "")
			.digest("hex");
		const allHeaders: Record<string, string> = {
			...headers,
			host: this.requestHost(),
			"x-amz-date": amzDate,
			"x-amz-content-sha256": payloadHash,
		};

		const signedHeaderKeys = Object.keys(allHeaders).sort();
		const signedHeaders = signedHeaderKeys.join(";");
		const canonicalHeaders = signedHeaderKeys
			.map((k) => `${k}:${allHeaders[k]}\n`)
			.join("");
		const canonicalRequest = [
			method,
			canonicalPath,
			"",
			canonicalHeaders,
			signedHeaders,
			payloadHash,
		].join("\n");
		const stringToSign = [
			"AWS4-HMAC-SHA256",
			amzDate,
			scope,
			createHash("sha256").update(canonicalRequest).digest("hex"),
		].join("\n");

		const kDate = createHmac("sha256", `AWS4${secretKey}`)
			.update(dateStamp)
			.digest();
		const kRegion = createHmac("sha256", kDate).update(region).digest();
		const kService = createHmac("sha256", kRegion).update(service).digest();
		const kSigning = createHmac("sha256", kService)
			.update("aws4_request")
			.digest();
		const signature = createHmac("sha256", kSigning)
			.update(stringToSign)
			.digest("hex");

		return {
			...allHeaders,
			authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
		};
	}

	async upload(options: StorageUploadOptions): Promise<StorageUploadResult> {
		const buffer =
			options.content instanceof ArrayBuffer
				? Buffer.from(options.content)
				: options.content;
		const canonicalPath = this.canonicalObjectPath(options.key);
		const headers = this.sign(
			"PUT",
			canonicalPath,
			{ "content-type": options.contentType },
			buffer,
		);
		const url = this.objectUrl(options.key);

		const response = await fetch(url, {
			method: "PUT",
			headers,
			body: new Uint8Array(buffer),
		});

		if (!response.ok) {
			throw new Error(
				`S3 upload failed: ${response.status} ${response.statusText}`,
			);
		}

		return { url, key: options.key };
	}

	async delete(options: StorageDeleteOptions): Promise<void> {
		const canonicalPath = this.canonicalObjectPath(options.key);
		const headers = this.sign("DELETE", canonicalPath, {}, null);
		const url = this.objectUrl(options.key);

		const response = await fetch(url, { method: "DELETE", headers });
		if (!response.ok && response.status !== 404) {
			throw new Error(
				`S3 delete failed: ${response.status} ${response.statusText}`,
			);
		}
	}

	getUrl(key: string): string {
		return this.objectUrl(key);
	}

	async healthCheck(): Promise<boolean> {
		try {
			const endpointUrl = new URL(this.config.endpoint);
			const url = this.config.virtualHosted
				? `https://${this.config.bucket}.${endpointUrl.host}/`
				: `${this.config.endpoint.replace(/\/$/, "")}/${this.config.bucket}/`;
			const canonicalPath = this.config.virtualHosted
				? "/"
				: `/${this.config.bucket}/`;
			const headers = this.sign("HEAD", canonicalPath, {}, null);
			const response = await fetch(url, {
				method: "HEAD",
				headers,
			});
			return response.ok || response.status === 404 || response.status === 403;
		} catch {
			return false;
		}
	}
}
