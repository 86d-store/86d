import { getSession } from "auth/actions";
import { verifyStoreAdminAccess } from "auth/store-access";
import env from "env";
import { NextResponse } from "next/server";
import { logger } from "utils/logger";
import { createRateLimiter } from "utils/rate-limit";
import { getStorage } from "~/lib/storage";
import {
	buildPublicUploadUrl,
	hasInvalidUploadKey,
	isProxyingUploadUrls,
	normalizeUploadKey,
} from "~/lib/upload-storage";

/** Upload rate limit: 30 uploads per 5 minutes per user. */
const uploadLimiter = createRateLimiter({ limit: 30, window: 300_000 });

const ALLOWED_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/jpg",
	"image/webp",
	"image/gif",
	"image/svg+xml",
	"application/pdf",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (PDFs can be larger)
const MAX_IMAGE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB for raster images

/** Magic-byte signatures for allowed file types (detect spoofed MIME). */
const PNG_SIG = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const WEBP_RIFF = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF
const WEBP_WEBP = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // WEBP at bytes 8–11
const GIF87_SIG = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]); // GIF87a
const GIF89_SIG = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
const PDF_SIG = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

function matchesMagicBytes(buffer: ArrayBuffer, mime: string): boolean {
	const bytes = new Uint8Array(buffer);
	if (mime === "image/jpeg" || mime === "image/jpg") {
		return (
			bytes.length >= 3 &&
			bytes[0] === 0xff &&
			bytes[1] === 0xd8 &&
			bytes[2] === 0xff
		);
	}
	if (mime === "image/png") {
		return bytes.length >= 8 && PNG_SIG.every((b, i) => bytes[i] === b);
	}
	if (mime === "image/webp") {
		return (
			bytes.length >= 12 &&
			WEBP_RIFF.every((b, i) => bytes[i] === b) &&
			WEBP_WEBP.every((b, i) => bytes[i + 8] === b)
		);
	}
	if (mime === "image/gif") {
		return (
			bytes.length >= 6 &&
			(GIF87_SIG.every((b, i) => bytes[i] === b) ||
				GIF89_SIG.every((b, i) => bytes[i] === b))
		);
	}
	if (mime === "image/svg+xml") {
		// SVG is text-based — check for XML declaration or <svg tag
		const text = new TextDecoder().decode(
			bytes.subarray(0, Math.min(256, bytes.length)),
		);
		return text.includes("<svg") || text.startsWith("<?xml");
	}
	if (mime === "application/pdf") {
		return bytes.length >= 4 && PDF_SIG.every((b, i) => bytes[i] === b);
	}
	return false;
}

function getMaxSizeForType(mime: string): number {
	if (mime === "application/pdf") return MAX_SIZE;
	return MAX_IMAGE_SIZE;
}

/** Reject SVGs containing script tags, event handlers, JS URIs, or XXE. */
function isSvgSafe(buffer: ArrayBuffer): boolean {
	const text = new TextDecoder().decode(new Uint8Array(buffer));
	// Block DOCTYPE and ENTITY declarations — XXE vector for any downstream
	// server-side SVG parsing (thumbnail, dimension extraction).
	if (/<!DOCTYPE/i.test(text)) return false;
	if (/<!ENTITY/i.test(text)) return false;
	// Block script elements (including namespace variants)
	if (/<script[\s>/]/i.test(text)) return false;
	// Block event handler attributes (onclick, onload, onerror, etc.)
	if (/\bon\w+\s*=/i.test(text)) return false;
	// Block javascript: URIs (including entity-encoded variants)
	if (/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i.test(text)) return false;
	// Block data: URIs in href/src/xlink:href (can embed scripts)
	if (/(?:href|src)\s*=\s*["']?\s*data\s*:/i.test(text)) return false;
	// Block foreignObject (can embed arbitrary HTML including scripts)
	if (/<foreignObject[\s>]/i.test(text)) return false;
	// Block use/iframe/embed/object elements (external content injection)
	if (/<(?:iframe|embed|object)[\s>]/i.test(text)) return false;
	// Block SVG animation elements that can trigger navigation or events
	if (
		/<(?:animate|set|animateTransform)\b[^>]*(?:onbegin|onend|onrepeat|attributeName\s*=\s*["']?href)/i.test(
			text,
		)
	)
		return false;
	return true;
}

export async function POST(request: Request) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const storeId = env.STORE_ID;
	if (!storeId) {
		return NextResponse.json(
			{ error: "Store not configured" },
			{ status: 500 },
		);
	}

	const access = verifyStoreAdminAccess(session.user);
	if (!access.hasAccess) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const rateResult = uploadLimiter.check(`upload:${session.user.id}`);
	if (!rateResult.allowed) {
		const retryAfter = Math.ceil((rateResult.resetAt - Date.now()) / 1000);
		return NextResponse.json(
			{ error: "Rate limit exceeded. Please slow down." },
			{ status: 429, headers: { "Retry-After": String(retryAfter) } },
		);
	}

	try {
		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		if (!ALLOWED_TYPES.has(file.type)) {
			return NextResponse.json(
				{
					error: "File type must be JPEG, PNG, WebP, GIF, SVG, or PDF",
				},
				{ status: 400 },
			);
		}

		const maxSize = getMaxSizeForType(file.type);
		if (file.size > maxSize) {
			const limitMB = Math.round((maxSize / (1024 * 1024)) * 10) / 10;
			return NextResponse.json(
				{ error: `File size must be less than ${limitMB} MB` },
				{ status: 400 },
			);
		}

		const buffer = await file.arrayBuffer();
		if (!matchesMagicBytes(buffer, file.type)) {
			return NextResponse.json(
				{ error: "File content does not match declared file type" },
				{ status: 400 },
			);
		}

		if (file.type === "image/svg+xml" && !isSvgSafe(buffer)) {
			return NextResponse.json(
				{
					error:
						"SVG contains potentially unsafe content (scripts, event handlers, or javascript URIs)",
				},
				{ status: 400 },
			);
		}

		const storage = getStorage();
		const key = `stores/${storeId}/${crypto.randomUUID()}`;
		const result = await storage.upload({
			key,
			content: buffer,
			contentType: file.type,
		});

		return NextResponse.json({
			url: isProxyingUploadUrls() ? buildPublicUploadUrl(key) : result.url,
		});
	} catch (error) {
		logger.error("Upload failed", { error: String(error) });
		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const storeId = env.STORE_ID;
	if (!storeId) {
		return NextResponse.json(
			{ error: "Store not configured" },
			{ status: 500 },
		);
	}

	const access = verifyStoreAdminAccess(session.user);
	if (!access.hasAccess) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await request.json();
		const rawKey = typeof body?.key === "string" ? body.key : "";
		const key = normalizeUploadKey(rawKey);

		if (!key) {
			return NextResponse.json({ error: "Missing file key" }, { status: 400 });
		}

		// Reject path traversal attempts
		if (hasInvalidUploadKey(key)) {
			return NextResponse.json({ error: "Invalid key" }, { status: 400 });
		}

		// Ensure the key belongs to this store to prevent cross-store deletion
		if (!key.startsWith(`stores/${storeId}/`)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const storage = getStorage();
		await storage.delete({ key });

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error("Delete failed", { error: String(error) });
		return NextResponse.json({ error: "Delete failed" }, { status: 500 });
	}
}
