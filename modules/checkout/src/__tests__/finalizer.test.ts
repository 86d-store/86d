import { describe, expect, it, vi } from "vitest";
import { createCheckoutFinalizationStore } from "../finalization";
import {
	type CheckoutFinalizationStepHandlers,
	createCheckoutFinalizer,
} from "../finalizer";
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

function admission(checkoutId = "checkout-1") {
	return {
		operationKey: "finalize-operation-1",
		checkoutId,
		expectedRevision: 3,
		acceptedInput: {
			acceptedOfferId: "offer-1",
			acceptanceId: "acceptance-1",
			catalogRevisionId: "catalog-revision-1",
			pricingDecisionId: "pricing-decision-1",
			discountDecisionIds: [],
			inventoryReservationIds: [],
			shippingQuoteId: "shipping-quote-1",
			shippingOptionId: "shipping-option-1",
			taxQuoteId: "tax-quote-1",
			paymentConnectionId: "payment-connection-1",
			paymentPolicyId: "authorize-then-capture-v1",
		},
	};
}

async function seedCheckout(
	storage: ReturnType<typeof createTransactionTestStore>,
) {
	await storage.data.upsert("checkoutSession", "checkout-1", {
		id: "checkout-1",
		revision: 3,
		status: "pending",
	});
}

/** Handlers that walk every checkpoint and finish with an Order. */
function passingHandlers(): CheckoutFinalizationStepHandlers {
	const handlers: Record<string, unknown> = {};
	for (const [index, step] of STEPS.entries()) {
		const nextStep = STEPS[index + 1];
		handlers[step] = nextStep
			? vi.fn(async () => ({
					outcome: { type: "advanced" as const, nextStep },
				}))
			: vi.fn(async () => ({
					outcome: { type: "completed" as const },
					result: { orderId: "order-1" },
				}));
	}
	return handlers as CheckoutFinalizationStepHandlers;
}

async function admitted(
	storage: ReturnType<typeof createTransactionTestStore>,
) {
	const store = createCheckoutFinalizationStore(storage.transactions);
	const result = await store.admit(admission());
	return { store, finalizationId: result.finalization.id };
}

describe("Checkout finalizer", () => {
	it("drives every checkpoint to a completed Finalization carrying its Order", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const { store, finalizationId } = await admitted(storage);
		const handlers = passingHandlers();
		const finalizer = createCheckoutFinalizer({ store, handlers });

		const run = await finalizer.run({ finalizationId });

		expect(run.finalization).toMatchObject({
			state: "completed",
			currentStep: "checkout_completion",
			result: { orderId: "order-1" },
		});
		expect(run.attemptsRecorded).toBe(STEPS.length);
		for (const step of STEPS) {
			expect(handlers[step]).toHaveBeenCalledOnce();
		}
	});

	it("resumes an interrupted run without repeating committed checkpoints", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const { store, finalizationId } = await admitted(storage);

		// A first run that stops early, as a crashed process would.
		const partial = passingHandlers();
		const stopped = await createCheckoutFinalizer({
			store,
			handlers: partial,
			maxAttemptsPerRun: 3,
		}).run({ finalizationId });
		expect(stopped.attemptsRecorded).toBe(3);
		expect(stopped.finalization.currentStep).toBe("inventory");

		// A fresh finalizer, as a scheduler would construct.
		const resumed = passingHandlers();
		const finished = await createCheckoutFinalizer({
			store,
			handlers: resumed,
		}).run({ finalizationId });

		expect(finished.finalization.state).toBe("completed");
		// The three checkpoints the first run committed are not re-executed.
		for (const step of STEPS.slice(0, 3)) {
			expect(resumed[step]).not.toHaveBeenCalled();
		}
		const snapshot = await store.getById(finalizationId);
		expect(snapshot.attempts).toHaveLength(STEPS.length);
	});

	it("records a step failure without leaking what the handler threw", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const { store, finalizationId } = await admitted(storage);
		const handlers = passingHandlers();
		handlers.checkout_revision = vi.fn(async () => {
			throw new Error("provider-secret-canary");
		});

		const run = await createCheckoutFinalizer({ store, handlers }).run({
			finalizationId,
		});

		expect(run.finalization).toMatchObject({
			state: "running",
			currentStep: "checkout_revision",
			attemptCount: 1,
		});
		const snapshot = await store.getById(finalizationId);
		expect(snapshot.attempts[0]).toMatchObject({
			outcome: { type: "retryable_failure" },
		});
		expect(JSON.stringify(snapshot)).not.toContain("provider-secret-canary");
	});

	it("stops at a checkpoint that has no handler instead of skipping it", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const { store, finalizationId } = await admitted(storage);
		const { inventory: _unconfigured, ...handlers } = passingHandlers();

		const run = await createCheckoutFinalizer({ store, handlers }).run({
			finalizationId,
		});

		expect(run.finalization).toMatchObject({
			state: "needs_attention",
			currentStep: "inventory",
			needsAttention: { code: "FINALIZATION_STEP_UNAVAILABLE" },
		});
		// It never reached, let alone completed, the money-moving checkpoints.
		expect(handlers.payment_outcome).not.toHaveBeenCalled();
		expect(run.finalization.result.orderId).toBeUndefined();
	});

	it("ends the run at a checkpoint that cannot advance, without retrying it", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const { store, finalizationId } = await admitted(storage);
		const handlers = passingHandlers();
		handlers.checkout_revision = vi.fn(async () => ({
			outcome: {
				type: "retryable_failure" as const,
				reason: { code: "UPSTREAM_BUSY" },
			},
		}));

		const run = await createCheckoutFinalizer({ store, handlers }).run({
			finalizationId,
		});

		// Retrying in a tight loop would add no information and would hammer the
		// capability that just failed. The next scheduled run resumes from here.
		expect(run.attemptsRecorded).toBe(1);
		expect(handlers.checkout_revision).toHaveBeenCalledOnce();
		expect(run.finalization).toMatchObject({
			state: "running",
			currentStep: "checkout_revision",
		});

		// The failure is durable, and resuming continues from the same checkpoint.
		const resumed = passingHandlers();
		const finished = await createCheckoutFinalizer({
			store,
			handlers: resumed,
		}).run({ finalizationId });
		expect(finished.finalization.state).toBe("completed");
		expect(resumed.checkout_revision).toHaveBeenCalledOnce();
	});

	it("leaves a compensating run to its compensation path", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const { store, finalizationId } = await admitted(storage);
		const handlers = passingHandlers();
		handlers.payment_outcome = vi.fn(async () => ({
			outcome: {
				type: "compensation_required" as const,
				reason: { code: "AUTHORIZATION_DECLINED" },
			},
		}));

		const run = await createCheckoutFinalizer({ store, handlers }).run({
			finalizationId,
		});

		expect(run.finalization).toMatchObject({
			state: "compensating",
			currentStep: "compensation",
		});
		expect(handlers.order).not.toHaveBeenCalled();
		expect(handlers.checkout_completion).not.toHaveBeenCalled();
	});

	it("does nothing to a Finalization that already completed", async () => {
		const storage = createTransactionTestStore();
		await seedCheckout(storage);
		const { store, finalizationId } = await admitted(storage);
		await createCheckoutFinalizer({ store, handlers: passingHandlers() }).run({
			finalizationId,
		});

		const handlers = passingHandlers();
		const rerun = await createCheckoutFinalizer({ store, handlers }).run({
			finalizationId,
		});

		expect(rerun.attemptsRecorded).toBe(0);
		expect(rerun.finalization.state).toBe("completed");
		for (const step of STEPS) {
			expect(handlers[step]).not.toHaveBeenCalled();
		}
	});
});
