import {
	restoreProcessEnv,
	setProcessEnv,
	snapshotProcessEnv,
} from "env/process-env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureHttpsUrl, getBaseUrl, httpsUrlHostLabel } from "../url";

describe("getBaseUrl", () => {
	const originalEnv = snapshotProcessEnv();

	beforeEach(() => {
		setProcessEnv("NEXT_PUBLIC_STORE_URL", undefined);
		setProcessEnv("RAILWAY_PUBLIC_DOMAIN", undefined);
		setProcessEnv("VERCEL_URL", undefined);
		setProcessEnv("PORT", undefined);
	});

	afterEach(() => {
		restoreProcessEnv(originalEnv);
	});

	it("returns NEXT_PUBLIC_STORE_URL when set", () => {
		setProcessEnv("NEXT_PUBLIC_STORE_URL", "https://mystore.com");
		expect(getBaseUrl()).toBe("https://mystore.com");
	});

	it("returns Vercel URL with https when VERCEL_URL is set", () => {
		setProcessEnv("VERCEL_URL", "my-app.vercel.app");
		expect(getBaseUrl()).toBe("https://my-app.vercel.app");
	});

	it("prefers NEXT_PUBLIC_STORE_URL over VERCEL_URL", () => {
		setProcessEnv("NEXT_PUBLIC_STORE_URL", "https://mystore.com");
		setProcessEnv("VERCEL_URL", "my-app.vercel.app");
		expect(getBaseUrl()).toBe("https://mystore.com");
	});

	it("uses RAILWAY_PUBLIC_DOMAIN with https when set (after NEXT_PUBLIC)", () => {
		setProcessEnv("RAILWAY_PUBLIC_DOMAIN", "svc.up.railway.app");
		setProcessEnv("VERCEL_URL", "my-app.vercel.app");
		expect(getBaseUrl()).toBe("https://svc.up.railway.app");
	});

	it("prefers NEXT_PUBLIC_STORE_URL over RAILWAY_PUBLIC_DOMAIN", () => {
		setProcessEnv("NEXT_PUBLIC_STORE_URL", "https://custom.example");
		setProcessEnv("RAILWAY_PUBLIC_DOMAIN", "svc.up.railway.app");
		expect(getBaseUrl()).toBe("https://custom.example");
	});

	it("returns localhost with PORT when no URLs set", () => {
		setProcessEnv("PORT", "4000");
		expect(getBaseUrl()).toBe("http://localhost:4000");
	});

	it("defaults to port 3000 when nothing is set", () => {
		expect(getBaseUrl()).toBe("http://localhost:3000");
	});
});

describe("ensureHttpsUrl", () => {
	it("returns null for nullish or blank", () => {
		expect(ensureHttpsUrl(null)).toBeNull();
		expect(ensureHttpsUrl(undefined)).toBeNull();
		expect(ensureHttpsUrl("")).toBeNull();
		expect(ensureHttpsUrl("   ")).toBeNull();
	});

	it("prefixes https for bare hostnames", () => {
		expect(ensureHttpsUrl("86d-production.up.railway.app")).toBe(
			"https://86d-production.up.railway.app",
		);
	});

	it("leaves explicit schemes unchanged", () => {
		expect(ensureHttpsUrl("https://example.com")).toBe("https://example.com");
		expect(ensureHttpsUrl("http://example.com")).toBe("http://example.com");
	});
});

describe("httpsUrlHostLabel", () => {
	it("returns host for absolute URLs", () => {
		expect(httpsUrlHostLabel("https://store.up.railway.app/path")).toBe(
			"store.up.railway.app",
		);
	});

	it("strips scheme when URL parsing fails", () => {
		expect(httpsUrlHostLabel("https://not a url")).toMatch(/not a url/);
	});
});
