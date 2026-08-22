import type { z } from "zod";
import type {
	CheckoutFinalization,
	CheckoutFinalizationStore,
	checkoutFinalizationAttemptOutcomeSchema,
	checkoutFinalizationStepSchema,
	recordCheckoutFinalizationAttemptInputSchema,
} from "./finalization";

type ExecutableStep = Exclude<
	z.infer<typeof checkoutFinalizationStepSchema>,
	"compensation"
>;

type AttemptOutcome = z.infer<typeof checkoutFinalizationAttemptOutcomeSchema>;

type AttemptResult = NonNullable<
	z.infer<typeof recordCheckoutFinalizationAttemptInputSchema>["result"]
>;

export type CheckoutFinalizationStepContext = Readonly<{
	finalization: CheckoutFinalization;
	step: ExecutableStep;
}>;

export type CheckoutFinalizationStepOutcome = Readonly<{
	outcome: AttemptOutcome;
	result?: AttemptResult;
}>;

/**
 * One checkpoint's work.
 *
 * A handler owns exactly one capability call and reports what it observed. It
 * must be idempotent under replay: the finalizer can call it again for the same
 * checkpoint after a crash that lost the attempt record, so each handler is
 * responsible for its own operation key with the capability it invokes.
 */
export type CheckoutFinalizationStepHandler = (
	context: CheckoutFinalizationStepContext,
) => Promise<CheckoutFinalizationStepOutcome>;

export type CheckoutFinalizationStepHandlers = Partial<
	Record<ExecutableStep, CheckoutFinalizationStepHandler>
>;

export type CheckoutFinalizerRunSummary = Readonly<{
	finalization: CheckoutFinalization;
	attemptsRecorded: number;
}>;

export type CheckoutFinalizer = Readonly<{
	run(input: { finalizationId: string }): Promise<CheckoutFinalizerRunSummary>;
}>;

/**
 * Recorded when a handler throws.
 *
 * The thrown value never reaches the ledger. A capability failure can carry a
 * provider message, a credential, or shopper data, and the attempt record is
 * durable and readable by operators, so only this fixed code is stored.
 */
const stepFailure = {
	type: "retryable_failure",
	reason: { code: "FINALIZATION_STEP_FAILED" },
} as const satisfies AttemptOutcome;

const stepUnavailable = {
	type: "needs_attention",
	reason: { code: "FINALIZATION_STEP_UNAVAILABLE" },
} as const satisfies AttemptOutcome;

function isExecutable(
	step: CheckoutFinalization["currentStep"],
): step is ExecutableStep {
	return step !== "compensation";
}

/**
 * Drives an admitted Finalization through its checkpoints.
 *
 * The aggregate owns every durable decision; this only decides what to attempt
 * next and hands the outcome back to be recorded. It is resumable by
 * construction: each run reads the committed state and continues from whatever
 * checkpoint that state names, so a crashed run and a scheduled retry are the
 * same operation.
 *
 * Attempt keys are derived from the checkpoint and the committed attempt count,
 * so a retry that follows a lost response replays the stored attempt instead of
 * recording a second one.
 */
export function createCheckoutFinalizer(options: {
	store: CheckoutFinalizationStore;
	handlers: CheckoutFinalizationStepHandlers;
	maxAttemptsPerRun?: number | undefined;
}): CheckoutFinalizer {
	const maxAttemptsPerRun = options.maxAttemptsPerRun ?? 25;
	if (!Number.isSafeInteger(maxAttemptsPerRun) || maxAttemptsPerRun < 1) {
		throw new Error(
			"The Finalization attempt limit must be a positive integer.",
		);
	}

	return {
		async run({ finalizationId }) {
			let { finalization } = await options.store.getById(finalizationId);
			let attemptsRecorded = 0;

			while (attemptsRecorded < maxAttemptsPerRun) {
				if (
					finalization.state !== "pending" &&
					finalization.state !== "running"
				)
					break;
				if (!isExecutable(finalization.currentStep)) break;

				const step = finalization.currentStep;
				const handler = options.handlers[step];
				const attemptKey = `finalize:${step}:${finalization.attemptCount}`;
				const expectedState = finalization.state;

				let outcome: AttemptOutcome;
				let result: AttemptResult | undefined;
				if (!handler) {
					// A checkpoint with no handler is a deployment gap, not a shopper
					// problem. Stopping here is what keeps an unconfigured Store from
					// stepping over inventory or payment on its way to an Order.
					outcome = stepUnavailable;
				} else {
					try {
						const produced = await handler({ finalization, step });
						outcome = produced.outcome;
						result = produced.result;
					} catch {
						outcome = stepFailure;
					}
				}

				const recorded = await options.store.recordAttempt({
					finalizationId,
					attemptKey,
					expectedAttemptCount: finalization.attemptCount,
					expectedState,
					expectedStep: step,
					outcome,
					...(result ? { result } : {}),
				});
				finalization = recorded.finalization;
				attemptsRecorded += 1;

				// A checkpoint that cannot advance now ends the run. Retrying it in a
				// tight loop would add no information and would hammer whatever
				// capability just failed; the next scheduled run resumes from here.
				if (outcome.type === "retryable_failure") break;
			}

			return { finalization, attemptsRecorded };
		},
	};
}
