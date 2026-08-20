import { describe, expect, it } from "vitest";
import {
	CheckoutFinalizationError,
	checkoutFinalizationAcceptedInputSchema,
	checkoutFinalizationLifecycleV1,
	checkoutFinalizationStateSchema,
	createCheckoutFinalizationStore,
} from "../finalization";
import { createTransactionTestStore } from "./transaction-test-utils";

const STEPS = [
	"checkout_revision",
	"accepted_offer",
	"shipping_and_tax",
	"inventory",
	"payment_connection",
	"payment_outcome",
	"order",
	"commerce_commit",
	"payment_settlement",
	"checkout_completion",
] as const;

const COMPENSATION_ACTIONS = [
	"release_inventory_reservation",
	"reverse_discount_redemption",
	"reverse_gift_card_redemption",
	"reverse_store_credit_debit",
	"cancel_or_reconcile_payment",
	"cancel_order",
	"adjust_tax",
	"void_shipping",
	"other_reconciliation",
] as const;

function acceptedInput() {
	return {
		acceptedOfferId: "offer-1",
		acceptanceId: "acceptance-1",
		catalogRevisionId: "catalog-revision-1",
		pricingDecisionId: "pricing-decision-1",
		discountDecisionIds: ["discount-b", "discount-a"],
		shippingQuoteId: "shipping-quote-1",
		shippingOptionId: "shipping-option-1",
		taxQuoteId: "tax-quote-1",
		inventoryReservationIds: ["reservation-b", "reservation-a"],
		paymentConnectionId: "payment-connection-1",
		paymentPolicyId: "authorize-then-capture-v1",
	};
}

function admission(checkoutId = "checkout-1") {
	return {
		operationKey: "finalize-operation-1",
		checkoutId,
		expectedRevision: 3,
		acceptedInput: acceptedInput(),
	};
}

async function seedCheckout(
	storage: ReturnType<typeof createTransactionTestStore>,
	input?: { id?: string; revision?: number; status?: string },
) {
	const id = input?.id ?? "checkout-1";
	await storage.data.upsert("checkoutSession", id, {
		id,
		revision: input?.revision ?? 3,
		status: input?.status ?? "pending",
	});
}

describe("Checkout Finalization admission", () => {
	it("fails closed without transactional or row-locking storage", async () => {
		expect(() => createCheckoutFinalizationStore(undefined)).toThrow(
			expect.objectContaining({ code: "TRANSACTION_UNAVAILABLE" }),
		);
		const storage = createTransactionTestStore({ locking: false });
		await seedCheckout(storage);

		await expect(
			createCheckoutFinalizationStore(storage.transactions).admit(admission()),
		).rejects.toMatchObject({ code: "LOCKING_UNAVAILABLE" });
		expect(storage.data.size("checkoutFinalization")).toBe(0);
	});

	it.each([
		["missing Checkout", undefined, "CHECKOUT_NOT_FOUND"],
		[
			"stale Checkout revision",
			{ revision: 4, status: "pending" },
			"CHECKOUT_REVISION_CONFLICT",
		],
		[
			"non-pending Checkout",
			{ revision: 3, status: "processing" },
			"CHECKOUT_STATE_INVALID",
		],
	] as const)("rejects a %s", async (_label, checkout, code) => {
		const storage = createTransactionTestStore();
		if (checkout) await seedCheckout(storage, checkout);
		const store = createCheckoutFinalizationStore(storage.transactions);

		await expect(store.admit(admission())).rejects.toMatchObject({ code });
		expect(storage.data.size("checkoutFinalization")).toBe(0);
	});

	it("admits one deterministic aggregate and emits its lifecycle atomically", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const result = await createCheckoutFinalizationStore(
			storage.transactions,
		).admit(admission());

		expect(result).toMatchObject({
			replayed: false,
			finalization: {
				checkoutId: "checkout-1",
				expectedRevision: 3,
				state: "pending",
				currentStep: "checkout_revision",
				attemptCount: 0,
				compensationCount: 0,
				result: {},
				acceptedInput: {
					discountDecisionIds: ["discount-a", "discount-b"],
					inventoryReservationIds: ["reservation-a", "reservation-b"],
				},
			},
		});
		expect(storage.events).toHaveLength(1);
		expect(storage.events[0]).toMatchObject({
			definition: checkoutFinalizationLifecycleV1,
			input: { payload: { cause: "admitted", state: "pending" } },
		});
	});

	it("replays after restart and rejects changed operation or accepted input", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const firstStore = createCheckoutFinalizationStore(storage.transactions);
		const first = await firstStore.admit(admission());
		const restartedStore = createCheckoutFinalizationStore(
			storage.transactions,
		);
		const replay = await restartedStore.admit({
			...admission(),
			acceptedInput: {
				...acceptedInput(),
				discountDecisionIds: [...acceptedInput().discountDecisionIds].reverse(),
				inventoryReservationIds: [
					...acceptedInput().inventoryReservationIds,
				].reverse(),
			},
		});

		expect(replay).toMatchObject({ replayed: true });
		expect(replay.finalization.id).toBe(first.finalization.id);
		expect(storage.data.size("checkoutFinalization")).toBe(1);
		expect(storage.events).toHaveLength(1);

		await expect(
			restartedStore.admit({
				...admission(),
				operationKey: "different-finalize-operation",
			}),
		).rejects.toMatchObject({ code: "FINALIZATION_CONFLICT" });
		await expect(
			restartedStore.admit({
				...admission(),
				acceptedInput: {
					...acceptedInput(),
					pricingDecisionId: "different-pricing-decision",
				},
			}),
		).rejects.toMatchObject({ code: "FINALIZATION_CONFLICT" });
	});

	it("accepts only owner-issued references, never shopper money or orphan options", () => {
		expect(
			checkoutFinalizationAcceptedInputSchema.safeParse({
				...acceptedInput(),
				shippingQuoteId: undefined,
			}),
		).toMatchObject({ success: false });
		expect(
			checkoutFinalizationAcceptedInputSchema.safeParse({
				...acceptedInput(),
				paymentConnectionId: undefined,
			}),
		).toMatchObject({ success: false });
		expect(
			checkoutFinalizationAcceptedInputSchema.safeParse({
				...acceptedInput(),
				total: 1,
			}),
		).toMatchObject({ success: false });
		expect(checkoutFinalizationStateSchema.safeParse("settled")).toMatchObject({
			success: false,
		});
	});
});

/** Advances a freshly admitted Finalization to its final checkpoint. */
async function advanceToCompletionStep(
	store: ReturnType<typeof createCheckoutFinalizationStore>,
	finalizationId: string,
): Promise<{ attemptCount: number; state: "pending" | "running" }> {
	let attemptCount = 0;
	let state: "pending" | "running" = "pending";
	for (const [index, step] of STEPS.entries()) {
		const nextStep = STEPS[index + 1];
		if (!nextStep) break;
		await store.recordAttempt({
			finalizationId,
			attemptKey: `advance-${step}`,
			expectedAttemptCount: attemptCount,
			expectedState: state,
			expectedStep: step,
			outcome: { type: "advanced", nextStep },
		});
		attemptCount += 1;
		state = "running";
	}
	return { attemptCount, state };
}

const completionResult = {
	orderId: "order-1",
	payment: {
		connectionId: "payment-connection-1",
		paymentId: "payment-1",
		captureOperationId: "capture-1",
	},
};

describe("Checkout Finalization completion", () => {
	it("reaches a terminal completed state carrying its Order reference", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		const { attemptCount, state } = await advanceToCompletionStep(
			store,
			admitted.finalization.id,
		);

		const completed = await store.recordAttempt({
			finalizationId: admitted.finalization.id,
			attemptKey: "complete-1",
			expectedAttemptCount: attemptCount,
			expectedState: state,
			expectedStep: "checkout_completion",
			outcome: { type: "completed" },
			result: completionResult,
		});

		expect(completed.replayed).toBe(false);
		expect(completed.finalization).toMatchObject({
			state: "completed",
			currentStep: "checkout_completion",
			attemptCount: attemptCount + 1,
			result: { orderId: "order-1" },
		});
		expect(completed.attempt).toMatchObject({
			stateAfter: "completed",
			step: "checkout_completion",
		});
		expect(storage.events.at(-1)).toMatchObject({
			definition: checkoutFinalizationLifecycleV1,
			input: {
				payload: {
					cause: "attempt_recorded",
					state: "completed",
					result: { orderId: "order-1" },
				},
			},
		});
	});

	it("refuses to complete without the Order the purchase produced", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		const { attemptCount, state } = await advanceToCompletionStep(
			store,
			admitted.finalization.id,
		);

		await expect(
			store.recordAttempt({
				finalizationId: admitted.finalization.id,
				attemptKey: "complete-without-order",
				expectedAttemptCount: attemptCount,
				expectedState: state,
				expectedStep: "checkout_completion",
				outcome: { type: "completed" },
				result: {
					payment: {
						connectionId: "payment-connection-1",
						paymentId: "payment-1",
					},
				},
			}),
		).rejects.toMatchObject({ code: "COMPLETION_INVALID" });

		const snapshot = await store.getById(admitted.finalization.id);
		expect(snapshot.finalization).toMatchObject({
			state: "running",
			attemptCount,
		});
	});

	it("refuses to complete before reaching the completion checkpoint", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());

		await expect(
			store.recordAttempt({
				finalizationId: admitted.finalization.id,
				attemptKey: "complete-too-early",
				expectedAttemptCount: 0,
				expectedState: "pending",
				expectedStep: "checkout_revision",
				outcome: { type: "completed" },
				result: completionResult,
			}),
		).rejects.toMatchObject({ code: "COMPLETION_INVALID" });

		const snapshot = await store.getById(admitted.finalization.id);
		expect(snapshot.finalization).toMatchObject({
			state: "pending",
			attemptCount: 0,
		});
	});

	it("is terminal: a completed Finalization takes no further attempt or compensation", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		const { attemptCount, state } = await advanceToCompletionStep(
			store,
			admitted.finalization.id,
		);
		const completing = {
			finalizationId: admitted.finalization.id,
			attemptKey: "complete-1",
			expectedAttemptCount: attemptCount,
			expectedState: state,
			expectedStep: "checkout_completion" as const,
			outcome: { type: "completed" as const },
			result: completionResult,
		};
		await store.recordAttempt(completing);

		// Replaying the completing key returns the same attempt, and does not
		// record a second one.
		const replay = await store.recordAttempt(completing);
		expect(replay.replayed).toBe(true);
		expect(replay.finalization.attemptCount).toBe(attemptCount + 1);

		await expect(
			store.recordAttempt({
				finalizationId: admitted.finalization.id,
				attemptKey: "after-completion",
				expectedAttemptCount: attemptCount + 1,
				expectedState: "running",
				expectedStep: "checkout_completion",
				outcome: {
					type: "retryable_failure",
					reason: { code: "TOO_LATE" },
				},
			}),
		).rejects.toMatchObject({ code: "STATE_CONFLICT" });

		await expect(
			store.recordCompensation({
				finalizationId: admitted.finalization.id,
				compensationKey: "compensate-after-completion",
				expectedCompensationCount: 0,
				action: "cancel_order",
				target: {
					ownerModule: "orders",
					resourceType: "order",
					resourceId: "order-1",
					operationId: "operation-1",
				},
				outcome: { type: "planned" },
			}),
		).rejects.toMatchObject({ code: "STATE_CONFLICT" });

		const snapshot = await store.getById(admitted.finalization.id);
		expect(snapshot.finalization.state).toBe("completed");
		expect(snapshot.attempts).toHaveLength(attemptCount + 1);
		expect(snapshot.compensations).toHaveLength(0);
	});
});

describe("Checkout Finalization attempts", () => {
	it("durably records a retryable failure at every declared checkpoint", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		let state: "pending" | "running" = "pending";
		let attemptCount = 0;

		for (const [index, step] of STEPS.entries()) {
			const failure = await store.recordAttempt({
				finalizationId: admitted.finalization.id,
				attemptKey: `retryable-${step}`,
				expectedAttemptCount: attemptCount,
				expectedState: state,
				expectedStep: step,
				outcome: {
					type: "retryable_failure",
					reason: {
						code: `INJECTED_${index}`,
						detail: `Failure after ${step}`,
					},
				},
			});
			attemptCount += 1;
			state = "running";
			expect(failure.finalization).toMatchObject({
				state: "running",
				currentStep: step,
				attemptCount,
			});

			const nextStep = STEPS[index + 1];
			if (nextStep) {
				await store.recordAttempt({
					finalizationId: admitted.finalization.id,
					attemptKey: `advance-${step}`,
					expectedAttemptCount: attemptCount,
					expectedState: "running",
					expectedStep: step,
					outcome: { type: "advanced", nextStep },
				});
				attemptCount += 1;
			}
		}

		const restarted = createCheckoutFinalizationStore(storage.transactions);
		const snapshot = await restarted.getById(admitted.finalization.id);
		expect(snapshot.finalization).toMatchObject({
			state: "running",
			currentStep: "checkout_completion",
			attemptCount: 19,
		});
		expect(snapshot.attempts).toHaveLength(19);
		expect(storage.events).toHaveLength(20);
	});

	it.each([
		[
			"ambiguous",
			{ type: "ambiguous", reason: { code: "PROVIDER_OUTCOME_UNKNOWN" } },
		],
		[
			"needs_attention",
			{ type: "needs_attention", reason: { code: "MANUAL_REVIEW" } },
		],
	] as const)(
		"persists a %s outcome without reporting success",
		async (_label, outcome) => {
			const storage = createTransactionTestStore();
			await seedCheckout(storage);
			const store = createCheckoutFinalizationStore(storage.transactions);
			const admitted = await store.admit(admission());
			const result = await store.recordAttempt({
				finalizationId: admitted.finalization.id,
				attemptKey: `attempt-${outcome.type}`,
				expectedAttemptCount: 0,
				expectedState: "pending",
				expectedStep: "checkout_revision",
				outcome,
			});

			expect(result.finalization).toMatchObject({
				state: "needs_attention",
				currentStep: "checkout_revision",
				needsAttention: outcome.reason,
			});
			expect(result.finalization.state).not.toBe("completed");
		},
	);

	it("replays an attempt once and rejects stale state or changed operation input", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		const input = {
			finalizationId: admitted.finalization.id,
			attemptKey: "advance-checkout-revision",
			expectedAttemptCount: 0,
			expectedState: "pending" as const,
			expectedStep: "checkout_revision" as const,
			outcome: {
				type: "advanced" as const,
				nextStep: "accepted_offer" as const,
			},
		};
		const first = await store.recordAttempt(input);
		const eventCount = storage.events.length;
		const replay = await createCheckoutFinalizationStore(
			storage.transactions,
		).recordAttempt(input);

		expect(first).toMatchObject({ replayed: false });
		expect(replay).toMatchObject({ replayed: true });
		expect(replay.attempt.id).toBe(first.attempt.id);
		expect(storage.events).toHaveLength(eventCount);
		await expect(
			store.recordAttempt({
				...input,
				outcome: { type: "advanced", nextStep: "shipping_and_tax" },
			}),
		).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
		await expect(
			store.recordAttempt({
				...input,
				attemptKey: "different-attempt-key",
			}),
		).rejects.toMatchObject({ code: "STATE_CONFLICT" });
	});

	it("never replaces a recorded Order or Payment reference", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		await store.recordAttempt({
			finalizationId: admitted.finalization.id,
			attemptKey: "record-order-reference",
			expectedAttemptCount: 0,
			expectedState: "pending",
			expectedStep: "checkout_revision",
			outcome: { type: "advanced", nextStep: "accepted_offer" },
			result: {
				orderId: "order-1",
				payment: {
					connectionId: "connection-1",
					paymentId: "payment-1",
					authorizationOperationId: "authorization-1",
				},
			},
		});

		await expect(
			store.recordAttempt({
				finalizationId: admitted.finalization.id,
				attemptKey: "replace-order-reference",
				expectedAttemptCount: 1,
				expectedState: "running",
				expectedStep: "accepted_offer",
				outcome: { type: "advanced", nextStep: "shipping_and_tax" },
				result: { orderId: "order-2" },
			}),
		).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
	});
});

describe("Checkout Finalization compensation", () => {
	it("records every required compensation identity idempotently", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		await store.recordAttempt({
			finalizationId: admitted.finalization.id,
			attemptKey: "require-compensation",
			expectedAttemptCount: 0,
			expectedState: "pending",
			expectedStep: "checkout_revision",
			outcome: {
				type: "compensation_required",
				reason: { code: "DOWNSTREAM_FAILURE" },
			},
		});

		for (const [index, action] of COMPENSATION_ACTIONS.entries()) {
			const result = await store.recordCompensation({
				finalizationId: admitted.finalization.id,
				compensationKey: `compensation-${action}`,
				expectedCompensationCount: index,
				action,
				target: {
					ownerModule: `owner-${index}`,
					resourceType: `resource-${index}`,
					resourceId: `resource-id-${index}`,
					operationId: `compensation-operation-${index}`,
				},
				outcome: { type: "succeeded" },
			});
			expect(result.compensation.sequence).toBe(index + 1);
		}

		const snapshot = await store.getById(admitted.finalization.id);
		expect(snapshot.compensations).toHaveLength(COMPENSATION_ACTIONS.length);
		expect(snapshot.finalization).toMatchObject({
			state: "compensating",
			compensationCount: COMPENSATION_ACTIONS.length,
		});
		const last = snapshot.compensations.at(-1);
		if (!last) throw new Error("Expected a compensation record");
		const eventCount = storage.events.length;
		const replay = await store.recordCompensation({
			finalizationId: admitted.finalization.id,
			compensationKey: last.compensationKey,
			expectedCompensationCount: last.sequence - 1,
			action: last.action,
			target: last.target,
			outcome: last.outcome,
		});
		expect(replay.replayed).toBe(true);
		expect(storage.events).toHaveLength(eventCount);
	});

	it("turns an ambiguous compensation into needs_attention", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		await store.recordAttempt({
			finalizationId: admitted.finalization.id,
			attemptKey: "require-compensation",
			expectedAttemptCount: 0,
			expectedState: "pending",
			expectedStep: "checkout_revision",
			outcome: {
				type: "compensation_required",
				reason: { code: "PAYMENT_TIMEOUT" },
			},
		});
		const result = await store.recordCompensation({
			finalizationId: admitted.finalization.id,
			compensationKey: "reconcile-payment-timeout",
			expectedCompensationCount: 0,
			action: "cancel_or_reconcile_payment",
			target: {
				ownerModule: "payments",
				resourceType: "payment",
				resourceId: "payment-1",
				operationId: "payment-reconcile-1",
			},
			outcome: {
				type: "ambiguous",
				reason: { code: "PAYMENT_OUTCOME_UNKNOWN" },
			},
		});

		expect(result.finalization).toMatchObject({
			state: "needs_attention",
			needsAttention: { code: "PAYMENT_OUTCOME_UNKNOWN" },
		});
	});
});

it("exposes stable typed Finalization errors", () => {
	const error = new CheckoutFinalizationError("STATE_CONFLICT", "conflict");
	expect(error).toMatchObject({
		name: "CheckoutFinalizationError",
		code: "STATE_CONFLICT",
		message: "conflict",
	});
});
