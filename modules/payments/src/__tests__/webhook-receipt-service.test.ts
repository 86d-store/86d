import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createPaymentAggregateStore } from "../payment-service";
import { createPaymentWebhookReceiptStore } from "../webhook-receipt-service";

const digest = (character: string) => character.repeat(64);

async function harness() {
	const transactions = createMockTransactionRunner({ storeId: "store-1" });
	await transactions.data.upsert("paymentConnection", "connection-1", {
		id: "connection-1",
		providerAccountId: "PAYPAL-MERCHANT-1",
		name: "Merchant PayPal",
		normalizedName: "merchant paypal",
		provider: "paypal",
		mode: "test",
		capabilities: ["authorization", "capture", "refund", "void"],
		health: "healthy",
		lifecycle: "enabled",
		secretReference: "secret/paypal-1",
		enabledAt: new Date("2026-08-13T00:00:00.000Z"),
		createdAt: new Date("2026-08-13T00:00:00.000Z"),
		updatedAt: new Date("2026-08-13T00:00:00.000Z"),
	});
	const payments = createPaymentAggregateStore(transactions.data, transactions);
	await payments.create({
		paymentId: "payment-1",
		idempotencyKey: "create-payment-1",
		checkoutId: "checkout-1",
		connectionId: "connection-1",
		paymentOption: "paypal",
		expectedAmount: 1_000,
		eligibleMerchandiseAmount: 800,
		currency: "USD",
	});
	return { transactions, payments };
}

function authorizationReceipt() {
	return {
		storeId: "store-1",
		connectionId: "connection-1",
		provider: "paypal",
		providerEventId: "WH-event-1",
		providerEventType: "PAYMENT.AUTHORIZATION.CREATED",
		payloadDigest: digest("a"),
		verificationKeyReference: "secret/paypal-1/webhook",
		fact: {
			kind: "confirmed_operation" as const,
			paymentId: "payment-1",
			operationId: "authorization-1",
			operation: "authorization" as const,
			amount: 1_000,
			currency: "USD",
			requestDigest: digest("b"),
			providerReference: "AUTH-1",
			occurredAt: new Date("2026-08-13T01:00:00.000Z"),
		},
	};
}

describe("durable Payment webhook receipts", () => {
	it("deduplicates an exact verified event and rejects a conflicting digest", async () => {
		const { transactions, payments } = await harness();
		const receipts = createPaymentWebhookReceiptStore(
			transactions.data,
			transactions,
			payments,
		);

		const created = await receipts.recordVerified(authorizationReceipt());
		const replayed = await receipts.recordVerified(authorizationReceipt());

		expect(created.replayed).toBe(false);
		expect(replayed).toEqual({ receipt: created.receipt, replayed: true });
		expect(transactions.data.size("paymentWebhookReceiptV2")).toBe(1);
		await expect(
			receipts.recordVerified({
				...authorizationReceipt(),
				payloadDigest: digest("c"),
			}),
		).rejects.toMatchObject({ code: "receipt_conflict" });
	});

	it("applies once after a process restart and acknowledges exact replays", async () => {
		const { transactions, payments } = await harness();
		const firstProcess = createPaymentWebhookReceiptStore(
			transactions.data,
			transactions,
			payments,
		);
		const recorded = await firstProcess.recordVerified(authorizationReceipt());

		const afterRestart = createPaymentWebhookReceiptStore(
			transactions.data,
			transactions,
			payments,
		);
		const applied = await afterRestart.process(recorded.receipt.id);
		const replayed = await afterRestart.process(recorded.receipt.id);

		expect(applied).toMatchObject({
			acknowledge: true,
			retryable: false,
			replayed: false,
			receipt: { state: "applied", processingAttempts: 1 },
		});
		expect(replayed).toMatchObject({
			acknowledge: true,
			retryable: false,
			replayed: true,
			receipt: { state: "applied", processingAttempts: 1 },
		});
		expect(await payments.get("payment-1")).toMatchObject({
			authorizedAmount: 1_000,
			confirmedRefundedAmount: 0,
		});
		expect(transactions.emitted).toHaveLength(1);
	});

	it("keeps dispute facts separate from refunds", async () => {
		const { transactions, payments } = await harness();
		const receipts = createPaymentWebhookReceiptStore(
			transactions.data,
			transactions,
			payments,
		);
		const recorded = await receipts.recordVerified({
			...authorizationReceipt(),
			providerEventId: "WH-dispute-1",
			providerEventType: "CUSTOMER.DISPUTE.CREATED",
			fact: {
				kind: "dispute" as const,
				paymentId: "payment-1",
				providerDisputeReference: "PP-D-1",
				state: "open" as const,
				occurredAt: new Date("2026-08-13T02:00:00.000Z"),
			},
		});

		expect(await receipts.process(recorded.receipt.id)).toMatchObject({
			acknowledge: true,
		});
		expect(await payments.get("payment-1")).toMatchObject({
			confirmedRefundedAmount: 0,
			dispute: {
				state: "open",
				providerDisputeReference: "PP-D-1",
			},
		});
	});

	it("returns a retryable response when durable local application is incomplete", async () => {
		const { transactions, payments } = await harness();
		const receipts = createPaymentWebhookReceiptStore(
			transactions.data,
			transactions,
			payments,
		);
		const recorded = await receipts.recordVerified({
			...authorizationReceipt(),
			providerEventId: "WH-capture-without-source",
			fact: {
				kind: "confirmed_operation" as const,
				paymentId: "payment-1",
				operationId: "capture-1",
				operation: "capture" as const,
				sourceOperationId: "missing-authorization",
				amount: 1_000,
				currency: "USD",
				requestDigest: digest("d"),
				providerReference: "CAPTURE-1",
				occurredAt: new Date("2026-08-13T03:00:00.000Z"),
			},
		});

		const result = await receipts.process(recorded.receipt.id);
		expect(result).toMatchObject({
			acknowledge: false,
			retryable: true,
			replayed: false,
			receipt: {
				state: "needs_attention",
				processingAttempts: 1,
				finalDisposition: "local_application_incomplete",
			},
		});
		expect((await payments.get("payment-1"))?.capturedAmount).toBe(0);
		expect(transactions.emitted).toHaveLength(0);
	});

	it("never stores raw provider payloads", async () => {
		const { transactions, payments } = await harness();
		const receipts = createPaymentWebhookReceiptStore(
			transactions.data,
			transactions,
			payments,
		);
		const { receipt } = await receipts.recordVerified(authorizationReceipt());

		expect(receipt).not.toHaveProperty("rawBody");
		expect(receipt).not.toHaveProperty("rawPayload");
		expect(JSON.stringify(receipt)).not.toContain("client_secret");
	});
});
