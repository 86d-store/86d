import type {
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type {
	PaymentConnectionProvider,
	PaymentProviderOperationOutcome,
} from "@86d-app/core/payment-connection-provider";
import { createMockDataService } from "@86d-app/core/test-utils";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { describe, expect, it, vi } from "vitest";
import {
	createPaymentConnectionController,
	PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS,
	PAYMENT_PENDING_RECONCILIATION_BACKOFF_MS,
	PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS,
	PaymentConnectionError,
	paymentOperationExecutionInputSchema,
} from "../connection-service";
import { createPaymentAggregateStore } from "../payment-service";

function transactionRunner(
	data: ModuleDataService,
	locking = true,
	onAccess?: (method: "findMany" | "getForUpdate", entity: string) => void,
) {
	let queue = Promise.resolve();
	const transaction: ModuleDataTransaction = {
		get: data.get.bind(data),
		upsert: data.upsert.bind(data),
		delete: data.delete.bind(data),
		findMany: async (entity, query) => {
			onAccess?.("findMany", entity);
			return data.findMany(entity, query);
		},
		async emit(definition, input) {
			return {
				id: crypto.randomUUID(),
				name: definition.name,
				version: definition.version,
				storeId: "store-1",
				sourceModule: definition.owner,
				aggregate: { ...input.aggregate, sequence: 1 },
				occurredAt: input.occurredAt ?? new Date(),
				payload: input.payload,
			};
		},
	};
	const lockingTransaction = {
		...transaction,
		getForUpdate: async (entity: string, id: string) => {
			onAccess?.("getForUpdate", entity);
			return data.get(entity, id);
		},
	};
	const active = locking ? lockingTransaction : transaction;
	const transactions: ModuleTransactionRunner = {
		transaction(work) {
			const result = queue.then(() => work(active));
			queue = result.then(
				() => undefined,
				() => undefined,
			);
			return result;
		},
	};
	return transactions;
}

function providerAdapter(options?: {
	connectionId?: string;
	providerAccountId?: string;
	provider?: string;
	capabilities?: PaymentConnectionProvider["capabilities"];
	execute?:
		| ((
				request: Parameters<PaymentConnectionProvider["execute"]>[0],
		  ) => Promise<PaymentProviderOperationOutcome>)
		| undefined;
	reconcile?:
		| ((
				request: Parameters<PaymentConnectionProvider["reconcile"]>[0],
		  ) => Promise<PaymentProviderOperationOutcome>)
		| undefined;
}) {
	const connectionId = options?.connectionId ?? "connection-1";
	const execute = vi.fn(
		options?.execute ??
			(async () => ({
				state: "succeeded" as const,
				providerReference: `provider-payment-${connectionId}`,
				result: { accepted: true },
			})),
	);
	const reconcile = vi.fn(
		options?.reconcile ??
			(async () => ({
				state: "succeeded" as const,
				providerReference: `provider-payment-${connectionId}`,
				result: { reconciled: true },
			})),
	);
	const adapter = {
		connectionId,
		providerAccountId: options?.providerAccountId ?? "merchant-account-1",
		provider: options?.provider ?? "test-provider",
		mode: "test" as const,
		capabilities: options?.capabilities ?? [
			"intent",
			"authorization",
			"capture",
			"refund",
			"void",
		],
		execute,
		reconcile,
	} satisfies PaymentConnectionProvider;
	return { adapter, execute, reconcile };
}

function connectionInput(
	id = "connection-1",
	capabilities: PaymentConnectionProvider["capabilities"] = [
		"intent",
		"authorization",
		"capture",
		"refund",
		"void",
	],
) {
	return {
		id,
		providerAccountId: "merchant-account-1",
		name: id === "connection-1" ? "Primary Cards" : `Connection ${id}`,
		provider: "test-provider",
		mode: "test" as const,
		capabilities: [...capabilities],
		secretReference: `secret://${id}`,
	};
}

async function enableConnection(
	controller: ReturnType<typeof createPaymentConnectionController>,
	id = "connection-1",
	capabilities?: PaymentConnectionProvider["capabilities"],
) {
	await controller.createConnection(connectionInput(id, capabilities));
	await controller.setConnectionHealth(id, "healthy");
	return controller.enableConnection(id);
}

async function createPayment(
	data: ModuleDataService,
	transactions: ModuleTransactionRunner,
	options?: {
		paymentId?: string;
		connectionId?: string;
		expectedAmount?: number;
	},
) {
	const paymentId = options?.paymentId ?? "payment-1";
	const expectedAmount = options?.expectedAmount ?? 1_000;
	const store = createPaymentAggregateStore(data, transactions);
	await store.create({
		paymentId,
		idempotencyKey: `create-${paymentId}-aggregate`,
		checkoutId: `checkout-${paymentId}`,
		connectionId: options?.connectionId ?? "connection-1",
		paymentOption: "card",
		expectedAmount,
		eligibleMerchandiseAmount: expectedAmount,
		currency: "USD",
	});
	return store;
}

async function makeScheduledReconciliationDue(
	data: ModuleDataService,
	operationId: string,
) {
	const operation = await data.get("paymentOperationV2", operationId);
	if (!operation) throw new Error("operation missing in test");
	await data.upsert("paymentOperationV2", operationId, {
		...operation,
		nextReconciliationAt: new Date(0),
		leaseExpiresAt: new Date(0),
	});
}

function intentInput(options?: {
	paymentId?: string;
	connectionId?: string;
	idempotencyKey?: string;
	amount?: number;
}) {
	return {
		paymentId: options?.paymentId ?? "payment-1",
		connectionId: options?.connectionId ?? "connection-1",
		idempotencyKey: options?.idempotencyKey ?? "create-intent-operation-1",
		payload: {
			operation: "intent" as const,
			amount: options?.amount ?? 1_000,
			currency: "USD",
		},
	};
}

describe("Payment Connections", () => {
	it("fails closed without transactional or locking storage", async () => {
		const data = createMockDataService();
		const missing = createPaymentConnectionController(data, undefined);
		const unlocked = createPaymentConnectionController(
			data,
			transactionRunner(data, false),
		);

		await expect(
			missing.createConnection(connectionInput()),
		).rejects.toMatchObject({ code: "transaction_unavailable" });
		await expect(
			unlocked.createConnection(connectionInput()),
		).rejects.toMatchObject({ code: "transaction_unavailable" });
	});

	it("normalizes names and prevents duplicate Connection selection ambiguity", async () => {
		const data = createMockDataService();
		const controller = createPaymentConnectionController(
			data,
			transactionRunner(data),
		);
		await controller.createConnection(connectionInput());

		await expect(
			controller.createConnection({
				...connectionInput("connection-2"),
				name: "primary cards",
			}),
		).rejects.toMatchObject({ code: "connection_name_conflict" });
		expect(await controller.listConnections()).toHaveLength(1);
	});

	it("requires a healthy, explicitly bound Connection before enablement", async () => {
		const data = createMockDataService();
		const intentOnly = providerAdapter({ capabilities: ["intent"] });
		const controller = createPaymentConnectionController(
			data,
			transactionRunner(data),
			[intentOnly.adapter],
		);
		await controller.createConnection(
			connectionInput("connection-1", ["intent", "refund"]),
		);
		await expect(
			controller.enableConnection("connection-1"),
		).rejects.toMatchObject({ code: "connection_not_usable" });
		await controller.setConnectionHealth("connection-1", "healthy");
		await expect(
			controller.enableConnection("connection-1"),
		).rejects.toMatchObject({ code: "provider_not_bound" });
	});

	it("fails an operation closed for a disabled, unhealthy, or revoked Connection", async () => {
		const data = createMockDataService();
		const provider = providerAdapter();
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await controller.createConnection(connectionInput());
		await createPayment(data, transactions);
		await expect(
			controller.executeOperation(intentInput()),
		).rejects.toMatchObject({ code: "connection_not_usable" });
		await controller.setConnectionHealth("connection-1", "healthy");
		await controller.enableConnection("connection-1");
		await controller.revokeConnection("connection-1");
		await createPayment(data, transactions, { paymentId: "payment-2" });
		await expect(
			controller.executeOperation(
				intentInput({
					paymentId: "payment-2",
					idempotencyKey: "create-intent-operation-2",
				}),
			),
		).rejects.toMatchObject({ code: "connection_not_usable" });

		expect(await data.findMany("paymentOperationV2", {})).toHaveLength(0);
		expect(await data.findMany("paymentOperationAttemptV2", {})).toHaveLength(
			0,
		);
		expect(provider.execute).not.toHaveBeenCalled();
		await expect(
			controller.setConnectionHealth("connection-1", "healthy"),
		).rejects.toMatchObject({ code: "connection_revoked" });
	});

	it("disables an enabled Connection when its secret reference rotates", async () => {
		const data = createMockDataService();
		const provider = providerAdapter();
		const controller = createPaymentConnectionController(
			data,
			transactionRunner(data),
			[provider.adapter],
		);
		await enableConnection(controller);
		const rotated = await controller.rotateSecretReference(
			"connection-1",
			"secret://rotated",
		);

		expect(rotated).toMatchObject({
			providerAccountId: "merchant-account-1",
			lifecycle: "disabled",
			health: "unknown",
			secretReference: "secret://rotated",
		});
	});

	it("rejects a rotated adapter for another provider account after restart", async () => {
		const data = createMockDataService();
		const transactions = transactionRunner(data);
		const original = providerAdapter();
		const firstController = createPaymentConnectionController(
			data,
			transactions,
			[original.adapter],
		);
		await enableConnection(firstController);
		await firstController.rotateSecretReference(
			"connection-1",
			"secret://rotated",
		);

		const wrongAccount = providerAdapter({
			providerAccountId: "merchant-account-2",
		});
		const restarted = createPaymentConnectionController(data, transactions, [
			wrongAccount.adapter,
		]);
		await restarted.setConnectionHealth("connection-1", "healthy");

		await expect(
			restarted.enableConnection("connection-1"),
		).rejects.toMatchObject({ code: "provider_not_bound" });
		expect(await restarted.getConnection("connection-1")).toMatchObject({
			providerAccountId: "merchant-account-1",
			secretReference: "secret://rotated",
			lifecycle: "disabled",
		});
		expect(wrongAccount.execute).not.toHaveBeenCalled();
	});

	it("rejects multiple provider adapters bound to the same Connection", () => {
		const data = createMockDataService();
		const first = providerAdapter();
		const second = providerAdapter();

		expect(() =>
			createPaymentConnectionController(data, transactionRunner(data), [
				first.adapter,
				second.adapter,
			]),
		).toThrow(expect.objectContaining({ code: "provider_not_bound" }));
	});
});

describe("connection-bound Payment operations", () => {
	it("locks the Payment owner before reading sibling reservations", async () => {
		const data = createMockDataService();
		const access: string[] = [];
		const provider = providerAdapter();
		const transactions = transactionRunner(data, true, (method, entity) => {
			access.push(`${method}:${entity}`);
		});
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		access.length = 0;

		await controller.executeOperation(intentInput());

		const ownerLock = access.indexOf("getForUpdate:paymentV2Lock");
		const siblingRead = access.indexOf("findMany:paymentOperationV2");
		expect(ownerLock).toBeGreaterThanOrEqual(0);
		expect(siblingRead).toBeGreaterThan(ownerLock);
	});

	it("replays the same operation after restart and rejects changed same-key input", async () => {
		const data = createMockDataService();
		const provider = providerAdapter();
		const transactions = transactionRunner(data);
		const firstController = createPaymentConnectionController(
			data,
			transactions,
			[provider.adapter],
		);
		await enableConnection(firstController);
		await createPayment(data, transactions);
		const first = await firstController.executeOperation(intentInput());
		const restarted = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		const replay = await restarted.executeOperation(intentInput());

		expect(first).toMatchObject({
			state: "succeeded",
			connectionId: "connection-1",
			attempt: 1,
			revision: 2,
		});
		expect(replay).toEqual(first);
		expect(first.idempotencyKey).toBe("create-intent-operation-1");
		expect(provider.execute).toHaveBeenCalledTimes(1);
		expect(provider.execute).toHaveBeenCalledWith(
			expect.objectContaining({
				idempotencyKey: "create-intent-operation-1",
				createdAt: first.createdAt,
				payload: intentInput().payload,
			}),
		);
		await expect(
			restarted.executeOperation(intentInput({ amount: 1_001 })),
		).rejects.toMatchObject({ code: "idempotency_conflict" });
	});

	it("rejects an upstream-unsafe caller key before persisting an operation", async () => {
		const data = createMockDataService();
		const provider = providerAdapter();
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);

		await expect(
			controller.executeOperation(
				intentInput({ idempotencyKey: "k".repeat(109) }),
			),
		).rejects.toBeDefined();
		expect(await data.findMany("paymentOperationV2", {})).toHaveLength(0);
		expect(await data.findMany("paymentOperationAttemptV2", {})).toHaveLength(
			0,
		);
		expect(provider.execute).not.toHaveBeenCalled();
	});

	it("persists an ambiguous provider timeout and reconciles it after restart", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async () => {
				throw new Error("provider timed out");
			},
			reconcile: async () => ({
				state: "succeeded",
				providerReference: "provider-payment-1",
				result: { reconciled: true },
			}),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const ambiguous = await controller.executeOperation(intentInput());
		const restarted = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		const reconciled = await restarted.reconcileOperation(ambiguous.id);
		const attempts = await restarted.listOperationAttempts(ambiguous.id);

		expect(ambiguous).toMatchObject({
			state: "ambiguous",
			outcome: { reason: "provider_outcome_unknown" },
		});
		expect(reconciled).toMatchObject({
			state: "succeeded",
			providerReference: "provider-payment-1",
			attempt: 2,
		});
		expect(attempts.map(({ state }) => state)).toEqual([
			"ambiguous",
			"succeeded",
		]);
		expect(provider.reconcile).toHaveBeenCalledWith(
			expect.objectContaining({
				createdAt: ambiguous.createdAt,
				payload: intentInput().payload,
			}),
		);
	});

	it.each(["pending", "requires_action"] as const)(
		"persists provider-known %s without advancing Payment or repeating an exact caller key",
		async (state) => {
			const data = createMockDataService();
			const provider = providerAdapter({
				execute: async () => ({
					state,
					providerReference: "provider-payment-1",
					result: { providerStatus: state },
				}),
			});
			const transactions = transactionRunner(data);
			const controller = createPaymentConnectionController(data, transactions, [
				provider.adapter,
			]);
			await enableConnection(controller);
			const payments = await createPayment(data, transactions);

			const first = await controller.executeOperation(intentInput());
			const replay = await controller.executeOperation(intentInput());
			const payment = await payments.get("payment-1");
			const attempts = await controller.listOperationAttempts(first.id);

			expect(first).toMatchObject({
				state,
				providerReference: "provider-payment-1",
				outcome: { providerStatus: state },
				reconciliationAttempts: 0,
			});
			expect(first.nextReconciliationAt).toBeInstanceOf(Date);
			const expectedDelay =
				state === "pending"
					? PAYMENT_PENDING_RECONCILIATION_BACKOFF_MS[0]
					: PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS[0];
			expect(
				(first.nextReconciliationAt as Date).getTime() -
					first.updatedAt.getTime(),
			).toBe(expectedDelay);
			expect(first.deadLetteredAt).toBeUndefined();
			expect(replay).toEqual(first);
			expect(provider.execute).toHaveBeenCalledTimes(1);
			expect(payment).toMatchObject({
				state: "pending",
				authorizedAmount: 0,
				capturedAmount: 0,
				providerReferences: [],
				revision: 1,
			});
			expect(attempts).toMatchObject([
				{
					state,
					providerReference: "provider-payment-1",
					outcome: { providerStatus: state },
				},
			]);
		},
	);

	it("keeps action-required provider truth after its bounded automatic polling budget", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async () => ({
				state: "requires_action",
				providerReference: "provider-payment-1",
				result: { action: "shopper_authentication" },
			}),
			reconcile: async () => ({
				state: "requires_action",
				providerReference: "provider-payment-1",
				result: { action: "shopper_authentication" },
			}),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const initial = await controller.executeOperation(intentInput());

		expect(
			(initial.nextReconciliationAt as Date).getTime() -
				initial.updatedAt.getTime(),
		).toBe(PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS[0]);

		let result = initial;
		for (
			let attempt = 1;
			attempt <= PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS.length;
			attempt++
		) {
			await makeScheduledReconciliationDue(data, initial.id);
			result = await controller.reconcileOperation(initial.id, {
				trigger: "scheduled",
			});
		}

		expect(result).toMatchObject({
			state: "requires_action",
			providerReference: "provider-payment-1",
			reconciliationAttempts:
				PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS.length,
			needsAttentionReason:
				"Provider action is still required after the automatic reconciliation budget.",
		});
		expect(result.deadLetteredAt).toBeUndefined();
		expect(result.nextReconciliationAt).toBeUndefined();
	});

	it("manually reconciles known pending state through its original Connection", async () => {
		const data = createMockDataService();
		const original = providerAdapter({
			execute: async () => ({
				state: "pending",
				providerReference: "provider-payment-1",
				result: { providerStatus: "processing" },
			}),
			reconcile: async () => ({
				state: "succeeded",
				providerReference: "provider-payment-1",
				result: { providerStatus: "settled" },
			}),
		});
		const fallback = providerAdapter({ connectionId: "connection-2" });
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			original.adapter,
			fallback.adapter,
		]);
		await enableConnection(controller, "connection-1");
		await enableConnection(controller, "connection-2");
		await createPayment(data, transactions);
		const pending = await controller.executeOperation(intentInput());

		const reconciled = await controller.reconcileOperation(pending.id, {
			trigger: "manual",
			reason: "shopper reports authentication complete",
		});

		expect(reconciled).toMatchObject({
			state: "succeeded",
			connectionId: "connection-1",
			providerReference: "provider-payment-1",
		});
		expect(original.reconcile).toHaveBeenCalledTimes(1);
		expect(fallback.reconcile).not.toHaveBeenCalled();
	});

	it("marks an unresolved reconciliation as needs_attention", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async () => ({ state: "ambiguous" }),
			reconcile: async () => ({ state: "ambiguous" }),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const ambiguous = await controller.executeOperation(intentInput());
		const result = await controller.reconcileOperation(ambiguous.id);

		expect(result).toMatchObject({
			state: "needs_attention",
			needsAttentionReason:
				"Manual provider reconciliation did not establish a final outcome.",
			manualReconciliationCount: 1,
			lastReconciliationTrigger: "manual",
		});
	});

	it("backs off scheduled reconciliation and dead-letters after a bounded budget", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async () => ({ state: "ambiguous" }),
			reconcile: async () => ({ state: "ambiguous" }),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const ambiguous = await controller.executeOperation(intentInput());

		expect(
			(ambiguous.nextReconciliationAt as Date).getTime() -
				ambiguous.updatedAt.getTime(),
		).toBe(1_000);
		await expect(
			controller.reconcileOperation(ambiguous.id, { trigger: "scheduled" }),
		).rejects.toMatchObject({ code: "reconciliation_not_due" });

		let result = ambiguous;
		for (
			let attempt = 1;
			attempt <= PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS;
			attempt++
		) {
			await makeScheduledReconciliationDue(data, ambiguous.id);
			result = await controller.reconcileOperation(ambiguous.id, {
				trigger: "scheduled",
			});
		}

		expect(result).toMatchObject({
			state: "dead_letter",
			reconciliationAttempts: PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS,
			needsAttentionReason:
				"Automatic provider reconciliation budget was exhausted.",
		});
		expect(result.deadLetteredAt).toBeInstanceOf(Date);
		expect(result.nextReconciliationAt).toBeUndefined();
		expect(provider.reconcile).toHaveBeenCalledTimes(
			PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS,
		);
		const attempts = await controller.listOperationAttempts(ambiguous.id);
		expect(attempts).toHaveLength(1 + PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS);
		expect(attempts.slice(1).map(({ trigger }) => trigger)).toEqual(
			Array.from(
				{ length: PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS },
				() => "scheduled_reconciliation",
			),
		);

		const manual = await controller.reconcileOperation(ambiguous.id, {
			trigger: "manual",
			reason: "operator inspected provider dashboard",
		});
		expect(manual).toMatchObject({
			state: "needs_attention",
			manualReconciliationCount: 1,
			lastManualReconciliationReason: "operator inspected provider dashboard",
			lastReconciliationTrigger: "manual",
		});
	});

	it("keeps dead-lettered financial operations reserved against later keys", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async (request) =>
				request.payload.operation === "authorization"
					? {
							state: "succeeded",
							providerReference: "provider-authorization-1",
						}
					: { state: "ambiguous" },
			reconcile: async () => ({ state: "ambiguous" }),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const authorization = await controller.executeOperation({
			paymentId: "payment-1",
			connectionId: "connection-1",
			idempotencyKey: "authorization-before-dead-letter",
			payload: { operation: "authorization", amount: 1_000, currency: "USD" },
		});
		const firstCapture = await controller.executeOperation({
			paymentId: "payment-1",
			sourceOperationId: authorization.id,
			idempotencyKey: "ambiguous-capture-before-dead-letter",
			payload: {
				operation: "capture",
				amount: 600,
				currency: "USD",
				providerPaymentReference: "provider-authorization-1",
			},
		});
		for (
			let attempt = 1;
			attempt <= PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS;
			attempt++
		) {
			await makeScheduledReconciliationDue(data, firstCapture.id);
			await controller.reconcileOperation(firstCapture.id, {
				trigger: "scheduled",
			});
		}

		await expect(
			controller.executeOperation({
				paymentId: "payment-1",
				sourceOperationId: authorization.id,
				idempotencyKey: "capture-that-exceeds-dead-letter-reservation",
				payload: {
					operation: "capture",
					amount: 500,
					currency: "USD",
					providerPaymentReference: "provider-authorization-1",
				},
			}),
		).rejects.toMatchObject({ code: "CAPTURE_LIMIT_EXCEEDED" });
		expect(await controller.getOperation(firstCapture.id)).toMatchObject({
			state: "dead_letter",
		});
		expect(provider.execute).toHaveBeenCalledTimes(2);
	});

	it("recovers a stale running provider attempt through canonical reconciliation", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async () => {
				throw new Error("process outcome lost");
			},
			reconcile: async () => ({
				state: "succeeded",
				providerReference: "provider-payment-1",
			}),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const operation = await controller.executeOperation(intentInput());
		const stored = await data.get("paymentOperationV2", operation.id);
		const attempt = await data.get(
			"paymentOperationAttemptV2",
			`${operation.id}:1`,
		);
		if (!stored || !attempt)
			throw new Error("operation records missing in test");
		await data.upsert("paymentOperationV2", operation.id, {
			...stored,
			state: "running",
			leaseExpiresAt: new Date(0),
			nextReconciliationAt: undefined,
		});
		await data.upsert("paymentOperationAttemptV2", `${operation.id}:1`, {
			...attempt,
			state: "running",
			outcome: undefined,
			finishedAt: undefined,
		});

		const recovered = await controller.reconcileOperation(operation.id, {
			trigger: "scheduled",
		});
		const attempts = await controller.listOperationAttempts(operation.id);

		expect(recovered).toMatchObject({
			state: "succeeded",
			reconciliationAttempts: 1,
			providerReference: "provider-payment-1",
		});
		expect(attempts).toMatchObject([
			{
				state: "ambiguous",
				outcome: { reason: "stale_running_recovered" },
			},
			{ state: "succeeded", trigger: "scheduled_reconciliation" },
		]);
	});

	it("returns one definite provider failure on every exact caller-key replay", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async () => ({
				state: "failed",
				result: { reason: "declined" },
			}),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);

		const first = await controller.executeOperation(intentInput());
		const replay = await controller.executeOperation(intentInput());

		expect(first).toMatchObject({
			state: "failed",
			outcome: { reason: "declined" },
		});
		expect(replay).toEqual(first);
		expect(provider.execute).toHaveBeenCalledTimes(1);
		expect(await controller.listOperationAttempts(first.id)).toHaveLength(1);
	});

	it("requires an exact succeeded intent source for referenced authorization", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async (request) => ({
				state: "succeeded",
				providerReference:
					request.payload.operation === "intent"
						? "provider-intent-1"
						: "provider-authorization-1",
			}),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const intent = await controller.executeOperation(intentInput());

		await expect(
			controller.executeOperation({
				paymentId: "payment-1",
				sourceOperationId: intent.id,
				idempotencyKey: "referenced-auth-wrong-amount",
				payload: {
					operation: "authorization",
					amount: 999,
					currency: "USD",
					providerPaymentReference: "provider-intent-1",
				},
			}),
		).rejects.toMatchObject({ code: "OPERATION_INVALID" });

		await expect(
			controller.executeOperation({
				paymentId: "payment-1",
				connectionId: "connection-1",
				idempotencyKey: "referenced-auth-without-source",
				payload: {
					operation: "authorization",
					amount: 1_000,
					currency: "USD",
					providerPaymentReference: "provider-intent-1",
				},
			}),
		).rejects.toBeDefined();
		await expect(
			controller.executeOperation({
				paymentId: "payment-1",
				connectionId: "connection-1",
				idempotencyKey: "direct-auth-ignores-existing-intent",
				payload: {
					operation: "authorization",
					amount: 1_000,
					currency: "USD",
				},
			}),
		).rejects.toMatchObject({ code: "SOURCE_OPERATION_INVALID" });
		await expect(
			controller.executeOperation({
				paymentId: "payment-1",
				sourceOperationId: intent.id,
				idempotencyKey: "referenced-auth-wrong-source-ref",
				payload: {
					operation: "authorization",
					amount: 1_000,
					currency: "USD",
					providerPaymentReference: "substituted-intent",
				},
			}),
		).rejects.toMatchObject({ code: "invalid_operation_state" });

		const authorization = await controller.executeOperation({
			paymentId: "payment-1",
			sourceOperationId: intent.id,
			idempotencyKey: "referenced-auth-correct-source",
			payload: {
				operation: "authorization",
				amount: 1_000,
				currency: "USD",
				providerPaymentReference: "provider-intent-1",
			},
		});

		expect(authorization).toMatchObject({
			state: "succeeded",
			connectionId: "connection-1",
			sourceOperationId: intent.id,
			providerReference: "provider-authorization-1",
		});
		expect(provider.execute).toHaveBeenCalledTimes(2);
		expect(provider.execute).toHaveBeenLastCalledWith(
			expect.objectContaining({
				source: {
					operationId: intent.id,
					operation: "intent",
					providerReference: "provider-intent-1",
					amount: 1_000,
					currency: "USD",
				},
			}),
		);
	});

	it("preserves a continuation as needs_attention when its original Connection is revoked", async () => {
		const data = createMockDataService();
		const original = providerAdapter({
			connectionId: "connection-1",
			execute: async () => ({
				state: "succeeded",
				providerReference: "provider-authorization-1",
			}),
		});
		const fallback = providerAdapter({ connectionId: "connection-2" });
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			original.adapter,
			fallback.adapter,
		]);
		await enableConnection(controller, "connection-1");
		await enableConnection(controller, "connection-2");
		const aggregates = await createPayment(data, transactions);
		const authorization = await controller.executeOperation({
			paymentId: "payment-1",
			connectionId: "connection-1",
			idempotencyKey: "authorization-before-revocation",
			payload: { operation: "authorization", amount: 1_000, currency: "USD" },
		});
		await controller.revokeConnection("connection-1");

		const capture = await controller.executeOperation({
			paymentId: "payment-1",
			sourceOperationId: authorization.id,
			idempotencyKey: "capture-after-original-revocation",
			payload: {
				operation: "capture",
				amount: 1_000,
				currency: "USD",
				providerPaymentReference: "provider-authorization-1",
			},
		});

		expect(capture).toMatchObject({
			state: "needs_attention",
			connectionId: "connection-1",
			sourceOperationId: authorization.id,
			needsAttentionReason:
				"Original Payment Connection is unavailable (connection_not_usable).",
		});
		expect(
			(await controller.listOperationAttempts(capture.id))[0],
		).toMatchObject({
			state: "failed",
		});
		expect(await aggregates.get("payment-1")).toMatchObject({
			authorizedAmount: 1_000,
			capturedAmount: 0,
		});
		expect(original.execute).toHaveBeenCalledTimes(1);
		expect(fallback.execute).not.toHaveBeenCalled();
	});

	it("keeps an ambiguous operation recoverable when its original Connection is missing", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async () => {
				throw new Error("provider timed out");
			},
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const ambiguous = await controller.executeOperation(intentInput());
		await data.delete("paymentConnection", "connection-1");

		const result = await controller.reconcileOperation(ambiguous.id, {
			trigger: "manual",
			reason: "operator requested canonical lookup",
		});

		expect(result).toMatchObject({
			state: "needs_attention",
			connectionId: "connection-1",
			manualReconciliationCount: 1,
			needsAttentionReason:
				"Original Payment Connection is unavailable for reconciliation (connection_not_found).",
		});
		expect(provider.reconcile).not.toHaveBeenCalled();
		expect(
			(await controller.listOperationAttempts(ambiguous.id)).map(
				({ state }) => state,
			),
		).toEqual(["ambiguous", "failed"]);
	});

	it("routes equal partial refunds through the original immutable Connection", async () => {
		const data = createMockDataService();
		const original = providerAdapter({
			connectionId: "connection-1",
			execute: async (request) => {
				const providerReference =
					request.payload.operation === "refund"
						? `refund-${request.operationId}`
						: request.payload.operation === "capture"
							? "capture-reference"
							: "authorization-reference";
				return { state: "succeeded", providerReference };
			},
		});
		const other = providerAdapter({ connectionId: "connection-2" });
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			original.adapter,
			other.adapter,
		]);
		await enableConnection(controller, "connection-1");
		await enableConnection(controller, "connection-2");
		await createPayment(data, transactions);
		const authorization = await controller.executeOperation({
			paymentId: "payment-1",
			connectionId: "connection-1",
			idempotencyKey: "authorize-payment-1",
			payload: { operation: "authorization", amount: 1_000, currency: "USD" },
		});
		const capture = await controller.executeOperation({
			paymentId: "payment-1",
			sourceOperationId: authorization.id,
			idempotencyKey: "capture-payment-operation-1",
			payload: {
				operation: "capture",
				amount: 1_000,
				currency: "USD",
				providerPaymentReference: "authorization-reference",
			},
		});
		const refundInput = (idempotencyKey: string) => ({
			paymentId: "payment-1",
			sourceOperationId: capture.id,
			idempotencyKey,
			payload: {
				operation: "refund" as const,
				amount: 250,
				currency: "USD",
				providerPaymentReference: "capture-reference",
			},
		});
		const first = await controller.executeOperation(
			refundInput("partial-refund-operation-1"),
		);
		const second = await controller.executeOperation(
			refundInput("partial-refund-operation-2"),
		);

		expect(first).toMatchObject({
			state: "succeeded",
			connectionId: "connection-1",
			sourceOperationId: capture.id,
			operation: "refund",
		});
		expect(second).toMatchObject({
			state: "succeeded",
			connectionId: "connection-1",
		});
		expect(second.id).not.toBe(first.id);
		expect(original.execute).toHaveBeenCalledTimes(4);
		expect(original.execute).toHaveBeenLastCalledWith(
			expect.objectContaining({
				source: {
					operationId: capture.id,
					operation: "capture",
					providerReference: "capture-reference",
					amount: 1_000,
					currency: "USD",
				},
			}),
		);
		expect(other.execute).not.toHaveBeenCalled();
	});

	it("rejects a reversal with a substituted provider reference", async () => {
		const data = createMockDataService();
		const provider = providerAdapter({
			execute: async () => ({
				state: "succeeded",
				providerReference: "original-provider-reference",
			}),
		});
		const transactions = transactionRunner(data);
		const controller = createPaymentConnectionController(data, transactions, [
			provider.adapter,
		]);
		await enableConnection(controller);
		await createPayment(data, transactions);
		const source = await controller.executeOperation({
			paymentId: "payment-1",
			connectionId: "connection-1",
			idempotencyKey: "authorize-payment-operation-1",
			payload: { operation: "authorization", amount: 1_000, currency: "USD" },
		});

		await expect(
			controller.executeOperation({
				paymentId: "payment-1",
				sourceOperationId: source.id,
				idempotencyKey: "capture-substituted-reference",
				payload: {
					operation: "capture",
					amount: 100,
					currency: "USD",
					providerPaymentReference: "different-provider-reference",
				},
			}),
		).rejects.toMatchObject({ code: "invalid_operation_state" });
		expect(provider.execute).toHaveBeenCalledTimes(1);
	});

	it("does not model a zero-total Checkout as a provider Payment", () => {
		expect(
			paymentOperationExecutionInputSchema.safeParse(
				intentInput({ amount: 0 }),
			),
		).toMatchObject({ success: false });
	});
});

it("exposes stable typed Payment Connection errors", () => {
	const error = new PaymentConnectionError("operation_not_found", "missing");
	expect(error).toMatchObject({
		name: "PaymentConnectionError",
		code: "operation_not_found",
		message: "missing",
	});
});
