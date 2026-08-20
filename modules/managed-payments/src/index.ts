import type { PaymentOutcomeRecorderPort } from "@86d-app/core/payment-checkout-ports";
import type { Module, ModuleContext } from "@86d-app/core/types/module";
import { readManagedWorkloadConfig } from "@86d-app/sdk/workload-token-client";
import {
	MANAGED_PAYMENT_WORKLOAD_SCOPES,
	STORE_RUNTIME_WORKLOAD_AUDIENCE,
} from "./contracts";
import {
	createManagedPaymentClient,
	type ManagedPaymentClient,
} from "./managed-payment-client";
import {
	consumeManagedPaymentOutcomes,
	createManagedPaymentOutcomeConsumer,
	type ManagedPaymentOutcomeConsumer,
} from "./outcome-consumer";
import { createPrepareManagedPaymentEndpoint } from "./store/endpoints/prepare-managed-payment";

export type {
	ManagedPaymentOperationSnapshot,
	ManagedPaymentPrepareInput,
	ManagedPaymentPrepareResponse,
	ManagedPaymentStoreOutcome,
	SubmitManagedPaymentOperationInput,
} from "./contracts";
export type { ManagedPaymentOutcomeConsumerResult } from "./outcome-consumer";
export type { ManagedPaymentClient };
export {
	consumeManagedPaymentOutcomes,
	createManagedPaymentClient,
	createManagedPaymentOutcomeConsumer,
	MANAGED_PAYMENT_WORKLOAD_SCOPES,
	STORE_RUNTIME_WORKLOAD_AUDIENCE,
};

export interface ManagedPaymentsOptions {
	/** Override managed workload configuration instead of reading env vars. */
	workloadConfig?: Parameters<typeof createManagedPaymentClient>[0]["config"];
}

const managedPaymentsStorage = { kind: "none" } as const;

export default function managedPayments(
	options?: ManagedPaymentsOptions,
): Module {
	return {
		id: "managed-payments",
		version: "0.0.1",
		storage: managedPaymentsStorage,
		requires: {
			payments: {
				read: ["paymentStatus", "paymentAmount"],
			},
		},
		init: async (ctx: ModuleContext) => {
			const config = options?.workloadConfig ?? readManagedWorkloadConfig();
			const client = createManagedPaymentClient({ config });
			const paymentAggregates = ctx.controllers.paymentAggregates as
				| unknown
				| undefined as PaymentOutcomeRecorderPort | undefined;
			const outcomeConsumer: ManagedPaymentOutcomeConsumer | undefined =
				paymentAggregates
					? createManagedPaymentOutcomeConsumer({
							client,
							paymentAggregates,
						})
					: undefined;
			const controllers: Record<string, ManagedPaymentOutcomeConsumer> = {};
			if (outcomeConsumer) {
				controllers.managedPaymentOutcomes = outcomeConsumer;
			}
			return { controllers };
		},
		endpoints: {
			store: {
				"/payments/managed/prepare": createPrepareManagedPaymentEndpoint(),
			},
		},
	};
}
