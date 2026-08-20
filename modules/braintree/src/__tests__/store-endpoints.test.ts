import { describe, expect, it } from "vitest";
import { createStoreEndpoints } from "../store/endpoints/routes";

// ── Helpers ───────────────────────────────────────────────────────────────────
// Braintree sends application/x-www-form-urlencoded with bt_signature + bt_payload

function makeFormRequest(fields: Record<string, string>): Request {
	return new Request("https://example.com/api/braintree/webhook", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(fields).toString(),
	});
}

async function callEndpoint(
	endpoints: ReturnType<typeof createStoreEndpoints>,
	request: Request,
): Promise<Response> {
	return endpoints["/braintree/webhook"]({ request });
}

// ── Factory ───────────────────────────────────────────────────────────────────

describe("createStoreEndpoints — braintree", () => {
	it("returns an endpoint map with the /braintree/webhook path", () => {
		const endpoints = createStoreEndpoints({
			publicKey: "test-public-key",
			privateKey: "test-private-key",
		});
		expect(endpoints).toHaveProperty("/braintree/webhook");
		expect(endpoints["/braintree/webhook"]).toBeDefined();
	});

	it("rejects missing bt_signature or bt_payload before durable processing", async () => {
		const endpoints = createStoreEndpoints({
			publicKey: "pk",
			privateKey: "sk",
		});
		// Empty body — no bt_signature or bt_payload
		const req = makeFormRequest({});
		const res = await callEndpoint(endpoints, req);
		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({
			error: "Invalid or missing webhook signature.",
		});
	});

	it("endpoint returns 401 for an invalid signature", async () => {
		const endpoints = createStoreEndpoints({
			publicKey: "pk",
			privateKey: "sk",
		});
		// btPayload is valid base64 XML; btSignature has wrong HMAC
		const btPayload = btoa("<notification><kind>check</kind></notification>");
		const req = makeFormRequest({
			bt_signature: "pk|invalidsignature",
			bt_payload: btPayload,
		});
		const res = await callEndpoint(endpoints, req);
		expect(res.status).toBe(401);
	});

	it("contains a valid notification until durable receipt processing exists", async () => {
		// Build a real HMAC-SHA1 signature using Web Crypto
		const privateKey = "test-private-key";
		const publicKey = "test-public-key";
		const btPayload = btoa("<notification><kind>check</kind></notification>");

		const enc = new TextEncoder();
		const derivedKey = await crypto.subtle.digest(
			"SHA-1",
			enc.encode(privateKey),
		);
		const key = await crypto.subtle.importKey(
			"raw",
			derivedKey,
			{ name: "HMAC", hash: "SHA-1" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, enc.encode(btPayload));
		const hexSig = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const endpoints = createStoreEndpoints({ publicKey, privateKey });
		const req = makeFormRequest({
			bt_signature: `${publicKey}|${hexSig}`,
			bt_payload: btPayload,
		});
		const res = await callEndpoint(endpoints, req);
		expect(res.status).toBe(503);
		expect(res.headers.get("Retry-After")).toBe("60");
		await expect(res.json()).resolves.toEqual({
			code: "PAYMENT_WEBHOOK_DURABILITY_REQUIRED",
			error:
				"Braintree webhook processing requires a durable provider receipt.",
		});
	});
});
