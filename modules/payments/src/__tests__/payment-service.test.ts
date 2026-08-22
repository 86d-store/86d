import type {
	LockingModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import {
	confirmedPaymentOperationInputSchema,
	createPaymentAggregateStore,
} from "../payment-service";

function paymentInput() {
	return {
		paymentId: "payment-1",
		idempotencyKey: "create-payment-1",
		checkoutId: "checkout-1",
		connectionId: "connection-1",
		paymentOption: "card" as const,
		expectedAmount: 1_000,
		eligibleMerchandiseAmount: 800,
		currency: "USD",
	};
}

function confirmedOperation(
	operation: "intent" | "authorization" | "capture" | "refund" | "void",
	options: {
		operationId?: string;
		sourceOperationId?: string;
		amount?: number;
		currency?: string;
		connectionId?: string;
		requestDigest?: string;
		providerReference?: string;
	} = {},
) {
	return {
		paymentId: "payment-1",
		connectionId: options.connectionId ?? "connection-1",
		operationId: options.operationId ?? `${operation}-1`,
		operation,
		...(options.sourceOperationId
			? { sourceOperationId: options.sourceOperationId }
			: {}),
		...(operation === "void"
			? {}
			: {
					amount: options.amount ?? 1_000,
					currency: options.currency ?? "USD",
				}),
		requestDigest: options.requestDigest ?? "a".repeat(64),
		providerReference:
			options.providerReference ??
			`provider-${options.operationId ?? `${operation}-1`}`,
		confirmedAt: new Date("2026-08-13T12:00:00.000Z"),
	};
}

async function authorizeAndCapture(
	store: ReturnType<typeof createPaymentAggregateStore>,
) {
	await store.recordConfirmedOperation(
		confirmedOperation("authorization", { operationId: "authorization-1" }),
	);
	await store.recordConfirmedOperation(
		confirmedOperation("capture", {
			operationId: "capture-1",
			sourceOperationId: "authorization-1",
		}),
	);
}

describe("Payment v2 aggregate identity", () => {
	it("replays an exact creation and rejects changed immutable input", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);

		const created = await store.create(paymentInput());
		const replayed = await store.create(paymentInput());

		expect(created).toMatchObject({
			replayed: false,
			payment: {
				id: "payment-1",
				modelVersion: 2,
				checkoutId: "checkout-1",
				connectionId: "connection-1",
				paymentOption: "card",
				expectedAmount: 1_000,
				eligibleMerchandiseAmount: 800,
				currency: "USD",
				authorizedAmount: 0,
				capturedAmount: 0,
				voidedAmount: 0,
				confirmedRefundedAmount: 0,
				state: "pending",
				terminalState: "none",
				revision: 1,
			},
		});
		expect(replayed).toEqual({ payment: created.payment, replayed: true });
		await expect(
			store.create({ ...paymentInput(), currency: "EUR" }),
		).rejects.toMatchObject({ code: "PAYMENT_CONFLICT" });
		await expect(
			store.create({ ...paymentInput(), connectionId: "connection-2" }),
		).rejects.toMatchObject({ code: "PAYMENT_CONFLICT" });
		await expect(
			store.create({ ...paymentInput(), eligibleMerchandiseAmount: 799 }),
		).rejects.toMatchObject({ code: "PAYMENT_CONFLICT" });
		await expect(
			store.create({ ...paymentInput(), eligibleMerchandiseAmount: 1_001 }),
		).rejects.toMatchObject({ code: "INPUT_INVALID" });
		expect(transactions.emitted).toHaveLength(0);
	});

	it("binds one immutable Order reference", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());

		const bound = await store.bindOrder("payment-1", "order-1");
		const replayed = await store.bindOrder("payment-1", "order-1");

		expect(bound).toMatchObject({ orderId: "order-1", revision: 2 });
		expect(replayed).toEqual(bound);
		await expect(store.bindOrder("payment-1", "order-2")).rejects.toMatchObject(
			{ code: "IMMUTABLE_IDENTITY" },
		);
	});
});

describe("Payment v2 confirmed financial transitions", () => {
	it("requires a referenced authorization to match its exact intent amount", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		await store.recordConfirmedOperation(
			confirmedOperation("intent", { operationId: "intent-exact" }),
		);

		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("authorization", {
					operationId: "authorization-under",
					sourceOperationId: "intent-exact",
					amount: 999,
				}),
			),
		).rejects.toMatchObject({ code: "OPERATION_INVALID" });
	});

	it("enforces cumulative capture and refund ceilings across distinct operations", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		await store.recordConfirmedOperation(
			confirmedOperation("authorization", {
				operationId: "authorization-1",
			}),
		);
		await store.recordConfirmedOperation(
			confirmedOperation("capture", {
				operationId: "capture-1",
				sourceOperationId: "authorization-1",
				amount: 600,
			}),
		);
		await store.recordConfirmedOperation(
			confirmedOperation("capture", {
				operationId: "capture-2",
				sourceOperationId: "authorization-1",
				amount: 400,
			}),
		);
		await store.recordConfirmedOperation(
			confirmedOperation("refund", {
				operationId: "refund-1",
				sourceOperationId: "capture-1",
				amount: 250,
			}),
		);

		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("refund", {
					operationId: "refund-2",
					sourceOperationId: "capture-1",
					amount: 351,
				}),
			),
		).rejects.toMatchObject({ code: "REFUND_LIMIT_EXCEEDED" });
		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("capture", {
					operationId: "capture-3",
					sourceOperationId: "authorization-1",
					amount: 1,
				}),
			),
		).rejects.toMatchObject({ code: "CAPTURE_LIMIT_EXCEEDED" });

		const payment = await store.get("payment-1");
		expect(payment).toMatchObject({
			authorizedAmount: 1_000,
			capturedAmount: 1_000,
			confirmedRefundedAmount: 250,
			state: "partially_refunded",
			terminalState: "none",
			revision: 5,
		});
		expect(transactions.emitted).toHaveLength(4);
		expect(transactions.emitted.at(-1)).toMatchObject({
			name: "payment.transition-confirmed",
			version: 1,
			sourceModule: "payments",
			payload: {
				paymentId: "payment-1",
				paymentModelVersion: 2,
				eligibleMerchandiseAmount: 800,
				cause: {
					type: "provider_operation",
					operation: "refund",
					amount: 250,
					currency: "USD",
				},
			},
		});
	});

	it("keeps a fully refunded partial capture open for the unresolved authorization", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		await store.recordConfirmedOperation(
			confirmedOperation("authorization", {
				operationId: "authorization-1",
			}),
		);
		await store.recordConfirmedOperation(
			confirmedOperation("capture", {
				operationId: "capture-1",
				sourceOperationId: "authorization-1",
				amount: 500,
			}),
		);
		const refunded = await store.recordConfirmedOperation(
			confirmedOperation("refund", {
				operationId: "refund-1",
				sourceOperationId: "capture-1",
				amount: 500,
			}),
		);

		expect(refunded.payment).toMatchObject({
			authorizedAmount: 1_000,
			capturedAmount: 500,
			confirmedRefundedAmount: 500,
			state: "partially_refunded",
			terminalState: "none",
		});
		expect(refunded.payment.terminalAt).toBeUndefined();
		const voided = await store.recordConfirmedOperation(
			confirmedOperation("void", {
				operationId: "void-remainder",
				sourceOperationId: "authorization-1",
			}),
		);
		expect(voided.payment).toMatchObject({
			voidedAmount: 500,
			state: "partially_refunded",
			terminalState: "none",
		});
	});

	it("keeps currency, Connection, and source references immutable", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());

		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("authorization", { currency: "EUR" }),
			),
		).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("authorization", {
					connectionId: "connection-2",
				}),
			),
		).rejects.toMatchObject({ code: "IMMUTABLE_IDENTITY" });
		await store.recordConfirmedOperation(
			confirmedOperation("authorization", {
				operationId: "authorization-1",
			}),
		);
		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("refund", {
					operationId: "refund-before-capture",
					sourceOperationId: "authorization-1",
					amount: 100,
				}),
			),
		).rejects.toMatchObject({ code: "SOURCE_OPERATION_INVALID" });
	});

	it("replays one confirmed provider fact without duplicating totals or outbox facts", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		const input = confirmedOperation("authorization", {
			operationId: "authorization-1",
		});
		const before = await store.get("payment-1");
		if (!before) throw new Error("payment missing in test");

		const first = await store.recordConfirmedOperation(input);
		const replay = await store.recordConfirmedOperation(input);

		expect(first.replayed).toBe(false);
		expect(first.payment.updatedAt.getTime()).toBeGreaterThanOrEqual(
			before.updatedAt.getTime(),
		);
		expect(replay).toEqual({ payment: first.payment, replayed: true });
		expect(transactions.emitted).toHaveLength(1);
		await expect(
			store.recordConfirmedOperation({
				...input,
				requestDigest: "b".repeat(64),
			}),
		).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
	});

	it("does not apply one provider fact through two caller operation identities", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		await store.recordConfirmedOperation(
			confirmedOperation("authorization", {
				operationId: "authorization-a",
				amount: 600,
				providerReference: "provider-authorization-shared",
			}),
		);

		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("authorization", {
					operationId: "authorization-b",
					amount: 400,
					providerReference: "provider-authorization-shared",
				}),
			),
		).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
		expect(await store.get("payment-1")).toMatchObject({
			authorizedAmount: 600,
			revision: 2,
		});
		expect(transactions.emitted).toHaveLength(1);
	});

	it("commits the aggregate transition and outbox fact atomically", async () => {
		const rejectEmitBox: { value: boolean } = { value: false };
		const transactions = createMockTransactionRunner({
			beforeEmit() {
				if (rejectEmitBox.value) throw new Error("outbox unavailable");
			},
		});
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		rejectEmitBox.value = true;

		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("authorization", {
					operationId: "authorization-1",
				}),
			),
		).rejects.toThrow("outbox unavailable");
		expect(await store.get("payment-1")).toMatchObject({
			authorizedAmount: 0,
			revision: 1,
		});
		expect(transactions.emitted).toHaveLength(0);
	});

	it("serializes concurrent distinct operations so only one can consume the remaining ceiling", async () => {
		const base = createMockTransactionRunner();
		let queue = Promise.resolve();
		const transactions: ModuleTransactionRunner = {
			transaction<T>(
				work: (transaction: LockingModuleDataTransaction) => Promise<T>,
			) {
				const result = queue.then(() => base.transaction(work));
				queue = result.then(
					() => undefined,
					() => undefined,
				);
				return result;
			},
		};
		const store = createPaymentAggregateStore(base.data, transactions);
		await store.create(paymentInput());
		await store.recordConfirmedOperation(
			confirmedOperation("authorization", {
				operationId: "authorization-1",
			}),
		);

		const results = await Promise.allSettled([
			store.recordConfirmedOperation(
				confirmedOperation("capture", {
					operationId: "capture-a",
					sourceOperationId: "authorization-1",
					amount: 700,
				}),
			),
			store.recordConfirmedOperation(
				confirmedOperation("capture", {
					operationId: "capture-b",
					sourceOperationId: "authorization-1",
					amount: 700,
				}),
			),
		]);

		expect(results.map(({ status }) => status).sort()).toEqual([
			"fulfilled",
			"rejected",
		]);
		expect(await store.get("payment-1")).toMatchObject({
			capturedAmount: 700,
			state: "partially_captured",
		});
		expect(base.emitted).toHaveLength(2);
	});

	it("serializes concurrent partial refunds across separate keys", async () => {
		const base = createMockTransactionRunner();
		let queue = Promise.resolve();
		const transactions: ModuleTransactionRunner = {
			transaction<T>(
				work: (transaction: LockingModuleDataTransaction) => Promise<T>,
			) {
				const result = queue.then(() => base.transaction(work));
				queue = result.then(
					() => undefined,
					() => undefined,
				);
				return result;
			},
		};
		const store = createPaymentAggregateStore(base.data, transactions);
		await store.create(paymentInput());
		await authorizeAndCapture(store);

		const results = await Promise.allSettled([
			store.recordConfirmedOperation(
				confirmedOperation("refund", {
					operationId: "refund-a",
					sourceOperationId: "capture-1",
					amount: 700,
				}),
			),
			store.recordConfirmedOperation(
				confirmedOperation("refund", {
					operationId: "refund-b",
					sourceOperationId: "capture-1",
					amount: 700,
				}),
			),
		]);

		expect(results.map(({ status }) => status).sort()).toEqual([
			"fulfilled",
			"rejected",
		]);
		expect(await store.get("payment-1")).toMatchObject({
			confirmedRefundedAmount: 700,
			state: "partially_refunded",
		});
		expect(base.emitted).toHaveLength(3);
	});

	it("locks the financial lifecycle after a confirmed full void", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		await store.recordConfirmedOperation(
			confirmedOperation("authorization", {
				operationId: "authorization-1",
			}),
		);
		const voided = await store.recordConfirmedOperation(
			confirmedOperation("void", {
				operationId: "void-1",
				sourceOperationId: "authorization-1",
			}),
		);

		expect(voided.payment).toMatchObject({
			voidedAmount: 1_000,
			state: "voided",
			terminalState: "voided",
			revision: 3,
		});
		expect(voided.payment.terminalAt).toEqual(
			new Date("2026-08-13T12:00:00.000Z"),
		);
		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("capture", {
					operationId: "capture-after-void",
					sourceOperationId: "authorization-1",
					amount: 1,
				}),
			),
		).rejects.toMatchObject({ code: "TERMINAL_STATE" });
	});

	it("becomes terminal only after the fully captured amount is fully refunded", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		await authorizeAndCapture(store);
		const refunded = await store.recordConfirmedOperation(
			confirmedOperation("refund", {
				operationId: "refund-full",
				sourceOperationId: "capture-1",
				amount: 1_000,
			}),
		);

		expect(refunded.payment).toMatchObject({
			capturedAmount: 1_000,
			confirmedRefundedAmount: 1_000,
			state: "refunded",
			terminalState: "refunded",
			revision: 4,
		});
		expect(refunded.payment.terminalAt).toEqual(
			new Date("2026-08-13T12:00:00.000Z"),
		);
	});

	it("rejects cumulative financial totals outside safe integer bounds", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create({
			...paymentInput(),
			expectedAmount: Number.MAX_SAFE_INTEGER,
		});
		await store.recordConfirmedOperation(
			confirmedOperation("authorization", {
				operationId: "authorization-max",
				amount: Number.MAX_SAFE_INTEGER,
			}),
		);

		await expect(
			store.recordConfirmedOperation(
				confirmedOperation("authorization", {
					operationId: "authorization-overflow",
					amount: 1,
				}),
			),
		).rejects.toMatchObject({ code: "OPERATION_INVALID" });
	});
});

describe("Payment v2 dispute projection", () => {
	it("advances independently without creating a refund or regressing provider truth", async () => {
		const transactions = createMockTransactionRunner();
		const store = createPaymentAggregateStore(transactions.data, transactions);
		await store.create(paymentInput());
		await authorizeAndCapture(store);
		const opened = {
			paymentId: "payment-1",
			connectionId: "connection-1",
			eventId: "dispute-event-opened",
			eventDigest: "c".repeat(64),
			providerDisputeReference: "provider-dispute-1",
			state: "open" as const,
			occurredAt: new Date("2026-08-13T12:05:00.000Z"),
		};

		const first = await store.applyDispute(opened);
		const replay = await store.applyDispute(opened);
		await store.applyDispute({
			...opened,
			eventId: "dispute-event-lost",
			eventDigest: "d".repeat(64),
			state: "lost",
			occurredAt: new Date("2026-08-13T12:06:00.000Z"),
		});
		const reversed = await store.applyDispute({
			...opened,
			eventId: "dispute-event-reversed",
			eventDigest: "e".repeat(64),
			state: "reversed",
			occurredAt: new Date("2026-08-13T12:07:00.000Z"),
		});

		expect(first.payment.dispute.state).toBe("open");
		expect(replay.replayed).toBe(true);
		expect(reversed.payment).toMatchObject({
			capturedAmount: 1_000,
			confirmedRefundedAmount: 0,
			state: "captured",
			dispute: {
				state: "reversed",
				providerDisputeReference: "provider-dispute-1",
				revision: 3,
			},
		});
		await expect(
			store.applyDispute({
				...opened,
				eventId: "late-open-event",
				eventDigest: "f".repeat(64),
				occurredAt: new Date("2026-08-13T12:08:00.000Z"),
			}),
		).rejects.toMatchObject({ code: "DISPUTE_REGRESSION" });
		await expect(
			store.applyDispute({ ...opened, eventDigest: "f".repeat(64) }),
		).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
	});

	it("does not expose settlement as a Payment transition", () => {
		expect(
			confirmedPaymentOperationInputSchema.safeParse({
				...confirmedOperation("capture", {
					operationId: "capture-contract",
					sourceOperationId: "authorization-contract",
				}),
				operation: "settlement",
			}),
		).toMatchObject({ success: false });
	});
});
