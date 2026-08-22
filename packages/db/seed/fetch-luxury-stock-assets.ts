#!/usr/bin/env tsx
/**
 * Downloads pinned Unsplash / Pexels stock photos, resizes to seed dimensions, writes WebP
 * under packages/db/seed/assets/luxury-house/ and refreshes manifest.json attribution.
 *
 * Run from public/: bun run seed:fetch-luxury-assets
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = resolve(SCRIPT_DIR, "luxury-stock-sources.json");
const OUTPUT_ROOT = resolve(SCRIPT_DIR, "assets/luxury-house");
const MANIFEST_PATH = resolve(OUTPUT_ROOT, "manifest.json");

const PRODUCT_SIZE = { width: 1600, height: 2000 };
const BANNER_SIZE = { width: 2400, height: 1400 };
const LOGO_SIZE = { width: 1200, height: 1200 };

const USER_AGENT =
	"86d-seed-asset-fetch/1.0 (+https://github.com/86d-app/86d; stock photo pipeline)";

type SourceEntry = {
	relativePath: string;
	downloadUrl: string;
	licenseName: string;
	licenseUrl: string;
	photoPageUrl: string;
	alt: string;
};

type ManifestEntry = {
	relativePath: string;
	label: string;
	sourceNote: string;
	alt: string;
};

function targetSizeForPath(relativePath: string): {
	width: number;
	height: number;
} {
	if (relativePath === "brand/logo.webp") return LOGO_SIZE;
	if (relativePath.startsWith("products/")) return PRODUCT_SIZE;
	return BANNER_SIZE;
}

function sourceNote(entry: SourceEntry): string {
	return `Stock photo — ${entry.licenseName} — ${entry.photoPageUrl} (${entry.licenseUrl})`;
}

async function downloadImage(url: string): Promise<Buffer> {
	const res = await fetch(url, {
		headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*" },
		redirect: "follow",
	});
	if (!res.ok) {
		throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
	}
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length === 0) throw new Error(`Empty body for ${url}`);
	return buf;
}

const downloadCache = new Map<string, Promise<Buffer>>();

function downloadCached(url: string): Promise<Buffer> {
	const key = createHash("sha256").update(url).digest("hex");
	const hit = downloadCache.get(key);
	if (hit) return hit;
	const promise = downloadImage(url);
	downloadCache.set(key, promise);
	return promise;
}

async function writeWebp(
	relativePath: string,
	input: Buffer,
	size: { width: number; height: number },
): Promise<void> {
	const outPath = resolve(OUTPUT_ROOT, relativePath);
	mkdirSync(dirname(outPath), { recursive: true });
	const pipeline = sharp(input)
		.rotate()
		.resize(size.width, size.height, { fit: "cover", position: "attention" })
		.webp({ quality: 92, effort: 6 });
	await pipeline.toFile(outPath);
}

async function main(): Promise<void> {
	const raw = readFileSync(SOURCES_PATH, "utf8");
	const sources = JSON.parse(raw) as SourceEntry[];

	const byPath = new Map(sources.map((s) => [s.relativePath, s]));
	const manifestRaw = readFileSync(MANIFEST_PATH, "utf8");
	const manifest = JSON.parse(manifestRaw) as ManifestEntry[];

	for (const row of manifest) {
		const src = byPath.get(row.relativePath);
		if (!src) {
			throw new Error(
				`Missing luxury-stock-sources.json entry for ${row.relativePath}`,
			);
		}
	}

	if (sources.length !== manifest.length) {
		throw new Error(
			`sources count ${sources.length} !== manifest count ${manifest.length}`,
		);
	}

	const _uniqueUrls = [...new Set(sources.map((s) => s.downloadUrl))];

	for (const entry of sources) {
		const size = targetSizeForPath(entry.relativePath);
		const buf = await downloadCached(entry.downloadUrl);
		await writeWebp(entry.relativePath, buf, size);
	}

	const updated = manifest.map((row) => {
		const src = byPath.get(row.relativePath);
		if (!src) return row;
		return {
			...row,
			sourceNote: sourceNote(src),
			alt: src.alt,
		};
	});
	writeFileSync(MANIFEST_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
