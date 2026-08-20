import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { NextResponse } from "next/server";
import { getStorage } from "~/lib/storage";
import {
	hasInvalidUploadKey,
	isProxyingUploadUrls,
} from "~/lib/upload-storage";

const MIME_TYPES: Record<string, string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".pdf": "application/pdf",
};

const UPLOADS_DIR = resolve(process.env.STORAGE_LOCAL_DIR ?? "./uploads");

function buildResponseHeaders(
	contentType: string,
	contentLength?: string | null,
): Headers {
	const headers = new Headers({
		"Content-Type": contentType,
		"Cache-Control": "public, max-age=31536000, immutable",
		"X-Content-Type-Options": "nosniff",
	});

	if (contentLength) {
		headers.set("Content-Length", contentLength);
	}

	// SVGs and PDFs can contain scripts — prevent inline execution
	if (contentType.startsWith("image/svg+xml")) {
		headers.set(
			"Content-Security-Policy",
			"default-src 'none'; style-src 'unsafe-inline'",
		);
	}
	if (contentType.startsWith("application/pdf")) {
		headers.set("Content-Disposition", "attachment");
	}

	return headers;
}

/**
 * Serve locally-stored files when STORAGE_CLIENT=local.
 * Only serves files from the uploads directory — rejects path traversal.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	const key = path.filter(Boolean).join("/");

	if (hasInvalidUploadKey(key)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (process.env.STORAGE_CLIENT === "s3" && isProxyingUploadUrls()) {
		try {
			const storage = getStorage();
			const response = await fetch(storage.getUrl(key));

			if (response.status === 404) {
				return NextResponse.json({ error: "Not found" }, { status: 404 });
			}

			if (!response.ok || !response.body) {
				return NextResponse.json(
					{ error: "Upstream unavailable" },
					{ status: 502 },
				);
			}

			const headers = buildResponseHeaders(
				response.headers.get("content-type") ?? "application/octet-stream",
				response.headers.get("content-length"),
			);
			const etag = response.headers.get("etag");
			if (etag) {
				headers.set("ETag", etag);
			}

			return new NextResponse(response.body, { status: 200, headers });
		} catch {
			return NextResponse.json(
				{ error: "Upstream unavailable" },
				{ status: 502 },
			);
		}
	}

	if (process.env.STORAGE_CLIENT !== "local") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const filePath = resolve(join(UPLOADS_DIR, ...path));

	// Prevent path traversal
	if (!filePath.startsWith(UPLOADS_DIR)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (!existsSync(filePath)) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const ext = extname(filePath).toLowerCase();
	const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
	const content = readFileSync(filePath);
	const headers = buildResponseHeaders(contentType);
	return new NextResponse(content, { status: 200, headers });
}
