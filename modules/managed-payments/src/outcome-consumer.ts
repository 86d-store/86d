import type { PaymentOutcomeRecorderPort } from "@86d-app/core/payment-checkout-ports";
import type { ModuleController } from "@86d-app/core/types/module";
import type { ManagedPaymentStoreOutcome } from "./contracts";
import type { ManagedPaymentClient } from "./managed-payment-client";

export interface ManagedPaymentOutcomeConsumerOptions {
	client: ManagedPaymentClient;
	paymentAggregates: PaymentOutcomeRecorderPort;
	now?: (() => Date) | undefined;
}

export interface ManagedPaymentOutcomeConsumerResult {
	readonly processed: number;
	readonly acknowledged: number;
	readonly skipped: number;
	readonly failed: number;
}

function operationKindForOutcome(
	outcome: ManagedPaymentStoreOutcome,
): "authorization" | "capture" | "void" | "refund" | null {
	if (outcome.state !== "confirmed") return null;
	if (outcome.operationId.includes(":capture:")) return "capture";
	if (outcome.operationId.includes(":void:")) return "void";
	if (outcome.operationId.includes(":refund:")) return "refund";
	return "authorization";
}

function acknowledgementKey(outcome: ManagedPaymentStoreOutcome): string {
	return `outcome:${outcome.eventId}:${outcome.payloadDigest}`;
}

/**
 * Poll pending Control Plane outcomes and apply confirmed facts to the local
 * Payment v2 aggregate before acknowledging durable delivery.
 */
export async function consumeManagedPaymentOutcomes(
	options: ManagedPaymentOutcomeConsumerOptions,
): Promise<ManagedPaymentOutcomeConsumerResult> {
	const now = options.now ?? (() => new Date());
	let processed = 0;
	let acknowledged = 0;
	let skipped = 0;
	let failed = 0;

	let outcomes: readonly ManagedPaymentStoreOutcome[];
	try {
		outcomes = await options.client.listOutcomes();
	} catch {
		return { processed, acknowledged, skipped, failed: 1 };
	}

	for (const outcome of outcomes) {
		if (outcome.deliveryState === "acknowledged") {
			skipped += 1;
			continue;
		}

		const operation = operationKindForOutcome(outcome);
		if (!operation) {
			skipped += 1;
			continue;
		}

		if (
			outcome.amountMinorUnits === undefined ||
			outcome.currency === undefined ||
			!outcome.providerReference
		) {
			failed += 1;
			continue;
		}

		try {
			await options.paymentAggregates.recordConfirmedOperation({
				paymentId: outcome.paymentId,
				connectionId: outcome.connectionId,
				operationId: outcome.operationId,
				operation,
				amount: outcome.amountMinorUnits,
				currency: outcome.currency,
				requestDigest: outcome.payloadDigest,
				providerReference: outcome.providerReference,
				confirmedAt: new Date(outcome.occurredAt),
			});
			processed += 1;

			const ack = await options.client.acknowledgeOutcome({
				eventId: outcome.eventId,
				acknowledgementKey: acknowledgementKey(outcome),
			});
			if (ack.replayed || ack.outcome.deliveryState === "acknowledged") {
				acknowledged += 1;
			}
		} catch {
			failed += 1;
		}
	}

	void now;
	return { processed, acknowledged, skipped, failed };
}

export interface ManagedPaymentOutcomeConsumer extends ModuleController {
	poll(): Promise<ManagedPaymentOutcomeConsumerResult>;
}

export function createManagedPaymentOutcomeConsumer(
	options: ManagedPaymentOutcomeConsumerOptions,
): ManagedPaymentOutcomeConsumer {
	return {
		async poll() {
			return consumeManagedPaymentOutcomes(options);
		},
	};
}
