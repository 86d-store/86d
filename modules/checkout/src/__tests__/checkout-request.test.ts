import { describe, expect, it, vi } from "vitest";
import {
	checkoutRequestCreateInputSchema,
	createCheckoutRequestStore,
} from "../checkout-request";
import {
	canAccessCheckoutRequest,
	checkoutRequestProofDigest,
	deriveCheckoutRequestProof,
	publicCheckoutRequest,
	setCheckoutRequestProofCookie,
} from "../store/endpoints/checkout-request-access";
import { createTransactionTestStore } from "./transaction-test-utils";

const NOW = new Date("2026-08-13T12:00:00.000Z");
const PROOF_DIGEST = "a".repeat(64);

function requestInput() {
	return {
		operationKey: "checkout-request-operation-1",
		owner: { type: "guest" as const, id: "guest-owner-digest" },
		accessProofDigest: PROOF_DIGEST,
		reason: {
			code: "TAX_REVIEW_REQUIRED" as const,
			detail: " Needs <review> ",
		},
		contact: {
			email: "SHOPPER@EXAMPLE.COM",
			firstName: " <b>Ada</b> ",
			lastName: "Lovelace",
		},
		cartSnapshot: {
			cartId: "cart-1",
			revision: "2026-08-13T11:59:00.000Z",
			lines: [
				{ productId: "product-b", quantity: 1 },
				{ productId: "product-a", variantId: "variant-1", quantity: 2 },
			],
		},
		auditActor: { type: "guest" as const, id: "guest-owner-digest" },
	};
}

describe("Checkout Request aggregate", () => {
	it("fails closed without transactional or row-locking storage", async () => {
		const unavailable = await createCheckoutRequestStore(undefined).create(
			requestInput(),
		);
		const nonLocking = createTransactionTestStore({ locking: false });
		const unlocked = await createCheckoutRequestStore(
			nonLocking.transactions,
		).create(requestInput());

		expect(unavailable).toMatchObject({
			ok: false,
			code: "TRANSACTION_UNAVAILABLE",
		});
		expect(unlocked).toMatchObject({
			ok: false,
			code: "LOCKING_UNAVAILABLE",
		});
		expect(nonLocking.data.size("checkoutRequest")).toBe(0);
	});

	it("persists only a bounded, non-binding Cart snapshot", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const storage = createTransactionTestStore();
		const result = await createCheckoutRequestStore(
			storage.transactions,
		).create(requestInput());

		expect(result).toMatchObject({
			ok: true,
			replayed: false,
			request: {
				invitationState: "not_invited",
				contact: { email: "shopper@example.com", firstName: "Ada" },
				cartSnapshot: {
					cartId: "cart-1",
					lines: [
						{
							productId: "product-a",
							variantId: "variant-1",
							quantity: 2,
						},
						{ productId: "product-b", quantity: 1 },
					],
				},
				expiresAt: new Date("2026-09-12T12:00:00.000Z"),
			},
		});
		if (!result.ok) throw new Error("Checkout Request creation failed");
		expect(result.request).not.toHaveProperty("payment");
		expect(result.request).not.toHaveProperty("total");
		expect(result.request).not.toHaveProperty("tax");
		expect(result.request).not.toHaveProperty("shipping");
		expect(result.request).not.toHaveProperty("orderId");
		expect(storage.data.size("checkoutRequest")).toBe(1);
		vi.useRealTimers();
	});

	it("rejects credentials, money, duplicate lines, and guest requests without proof", () => {
		const input = requestInput();
		expect(
			checkoutRequestCreateInputSchema.safeParse({
				...input,
				paymentMethod: "pm_browser",
			}),
		).toMatchObject({ success: false });
		expect(
			checkoutRequestCreateInputSchema.safeParse({
				...input,
				total: 100,
			}),
		).toMatchObject({ success: false });
		expect(
			checkoutRequestCreateInputSchema.safeParse({
				...input,
				accessProofDigest: undefined,
			}),
		).toMatchObject({ success: false });
		expect(
			checkoutRequestCreateInputSchema.safeParse({
				...input,
				cartSnapshot: {
					...input.cartSnapshot,
					lines: [
						{ productId: "product-a", quantity: 1 },
						{ productId: "product-a", quantity: 2 },
					],
				},
			}),
		).toMatchObject({ success: false });
	});

	it("replays the same operation after a process restart without duplicating state", async () => {
		const storage = createTransactionTestStore();
		const firstStore = createCheckoutRequestStore(storage.transactions);
		const first = await firstStore.create(requestInput());
		const restartedStore = createCheckoutRequestStore(storage.transactions);
		const replay = await restartedStore.create({
			...requestInput(),
			cartSnapshot: {
				...requestInput().cartSnapshot,
				lines: [...requestInput().cartSnapshot.lines].reverse(),
			},
		});

		expect(first).toMatchObject({ ok: true, replayed: false });
		expect(replay).toMatchObject({ ok: true, replayed: true });
		if (!first.ok || !replay.ok) throw new Error("Checkout Request failed");
		expect(replay.request.id).toBe(first.request.id);
		expect(storage.data.size("checkoutRequest")).toBe(1);
		expect(storage.data.size("checkoutRequestOperation")).toBe(1);
	});

	it("rejects reuse of an operation key for changed input", async () => {
		const storage = createTransactionTestStore();
		const store = createCheckoutRequestStore(storage.transactions);
		await store.create(requestInput());
		const conflict = await store.create({
			...requestInput(),
			contact: { ...requestInput().contact, email: "other@example.com" },
		});

		expect(conflict).toMatchObject({
			ok: false,
			code: "IDEMPOTENCY_KEY_REUSED",
		});
		expect(storage.data.size("checkoutRequest")).toBe(1);
	});

	it("returns explicit missing and invalid stored-state decisions", async () => {
		const storage = createTransactionTestStore();
		const store = createCheckoutRequestStore(storage.transactions);
		expect(await store.getById("missing")).toMatchObject({
			ok: false,
			code: "REQUEST_NOT_FOUND",
		});

		await storage.data.upsert("checkoutRequest", "broken", {
			id: "broken",
		});
		expect(await store.getById("broken")).toMatchObject({
			ok: false,
			code: "REQUEST_STATE_INVALID",
		});
	});
});

describe("Checkout Request guest proof", () => {
	it("is retry-stable and bound to both the guest and operation", async () => {
		const first = await deriveCheckoutRequestProof("guest-a", "operation-1");
		expect(await deriveCheckoutRequestProof("guest-a", "operation-1")).toBe(
			first,
		);
		expect(await deriveCheckoutRequestProof("guest-b", "operation-1")).not.toBe(
			first,
		);
		expect(await deriveCheckoutRequestProof("guest-a", "operation-2")).not.toBe(
			first,
		);
	});

	it("authorizes only the scoped proof and never exposes proof or owner digests", async () => {
		const storage = createTransactionTestStore();
		const proof = "high-entropy-request-proof";
		const result = await createCheckoutRequestStore(
			storage.transactions,
		).create({
			...requestInput(),
			accessProofDigest: await checkoutRequestProofDigest(proof),
		});
		if (!result.ok) throw new Error("Checkout Request creation failed");

		const context = (cookie: string | null) => ({
			context: { session: null },
			getCookie: () => cookie,
			setCookie: () => "",
		});
		expect(await canAccessCheckoutRequest(context(proof), result.request)).toBe(
			true,
		);
		expect(
			await canAccessCheckoutRequest(
				context("checkout-request-id"),
				result.request,
			),
		).toBe(false);
		expect(
			await canAccessCheckoutRequest(
				context("shopper@example.com"),
				result.request,
			),
		).toBe(false);
		expect(publicCheckoutRequest(result.request)).not.toHaveProperty(
			"accessProofDigest",
		);
		expect(publicCheckoutRequest(result.request)).not.toHaveProperty("owner");
		expect(publicCheckoutRequest(result.request)).not.toHaveProperty(
			"auditActor",
		);
	});

	it("sets a secure, httpOnly, request-scoped cookie", async () => {
		const storage = createTransactionTestStore();
		const result = await createCheckoutRequestStore(
			storage.transactions,
		).create(requestInput());
		if (!result.ok) throw new Error("Checkout Request creation failed");
		const setCookie = vi.fn(() => "");

		setCheckoutRequestProofCookie(
			{ context: { session: null }, getCookie: () => null, setCookie },
			result.request,
			"proof",
		);

		expect(setCookie).toHaveBeenCalledWith(
			`checkout_request_guest_${result.request.id}`,
			"proof",
			expect.objectContaining({
				httpOnly: true,
				sameSite: "lax",
				path: "/api/checkout/requests",
			}),
		);
	});
});
