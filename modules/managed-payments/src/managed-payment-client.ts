import {
	createWorkloadTokenClient,
	type ManagedWorkloadConfig,
	type WorkloadTokenClient,
} from "@86d-app/sdk/workload-token-client";
import {
	MANAGED_PAYMENT_WORKLOAD_SCOPES,
	type ManagedPaymentOperationSnapshot,
	type ManagedPaymentPrepareInput,
	type ManagedPaymentPrepareResponse,
	type ManagedPaymentStoreOutcome,
	managedPaymentOperationSnapshotSchema,
	managedPaymentPrepareResponseSchema,
	managedPaymentStoreOutcomeSchema,
	STORE_RUNTIME_WORKLOAD_AUDIENCE,
	type SubmitManagedPaymentOperationInput,
	submitManagedPaymentOperationInputSchema,
} from "./contracts";

const MANAGED_PAYMENTS_RESOURCE = {
	audience: STORE_RUNTIME_WORKLOAD_AUDIENCE,
	scopes: MANAGED_PAYMENT_WORKLOAD_SCOPES,
} as const;

export interface ManagedPaymentClient {
	readonly configured: boolean;
	submitOperation(
		input: SubmitManagedPaymentOperationInput,
	): Promise<{ replayed: boolean; operation: ManagedPaymentOperationSnapshot }>;
	listOutcomes(): Promise<readonly ManagedPaymentStoreOutcome[]>;
	acknowledgeOutcome(input: {
		eventId: string;
		acknowledgementKey: string;
	}): Promise<{ replayed: boolean; outcome: ManagedPaymentStoreOutcome }>;
	preparePaymentOption(
		input: ManagedPaymentPrepareInput,
	): Promise<ManagedPaymentPrepareResponse>;
}

export interface CreateManagedPaymentClientOptions {
	config: ManagedWorkloadConfig | undefined;
	fetch?: typeof globalThis.fetch;
}

async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		throw new Error("Managed Payment Control Plane response was invalid.");
	}
}

function requireOk(response: Response): void {
	if (!response.ok) {
		throw new Error("Managed Payment Control Plane request failed.");
	}
}

export function createManagedPaymentClient(
	options: CreateManagedPaymentClientOptions,
): ManagedPaymentClient {
	const tokenClient: WorkloadTokenClient = createWorkloadTokenClient(
		options.fetch
			? { config: options.config, fetch: options.fetch }
			: { config: options.config },
	);

	return {
		configured: tokenClient.configured,
		async submitOperation(inputValue) {
			const parsed =
				submitManagedPaymentOperationInputSchema.safeParse(inputValue);
			if (!parsed.success) {
				throw new Error("Managed Payment operation input is invalid.");
			}
			const response = await tokenClient.request(
				MANAGED_PAYMENTS_RESOURCE,
				"v1/workloads/payments/operations/submit",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Idempotency-Key": parsed.data.idempotencyKey,
					},
					body: JSON.stringify(parsed.data),
				},
			);
			requireOk(response);
			const payload = (await readJson(response)) as {
				replayed?: unknown;
				operation?: unknown;
			};
			const operation = managedPaymentOperationSnapshotSchema.safeParse(
				payload.operation,
			);
			if (typeof payload.replayed !== "boolean" || !operation.success) {
				throw new Error("Managed Payment operation response was invalid.");
			}
			return { replayed: payload.replayed, operation: operation.data };
		},
		async listOutcomes() {
			const response = await tokenClient.request(
				MANAGED_PAYMENTS_RESOURCE,
				"v1/workloads/payments/outcomes",
				{ method: "GET" },
			);
			requireOk(response);
			const payload = (await readJson(response)) as { outcomes?: unknown };
			if (!Array.isArray(payload.outcomes)) {
				throw new Error("Managed Payment outcomes response was invalid.");
			}
			return payload.outcomes.flatMap((entry) => {
				const parsed = managedPaymentStoreOutcomeSchema.safeParse(entry);
				return parsed.success ? [parsed.data] : [];
			});
		},
		async acknowledgeOutcome(input) {
			const response = await tokenClient.request(
				MANAGED_PAYMENTS_RESOURCE,
				"v1/workloads/payments/outcomes/acknowledge",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(input),
				},
			);
			requireOk(response);
			const payload = (await readJson(response)) as {
				replayed?: unknown;
				outcome?: unknown;
			};
			const outcome = managedPaymentStoreOutcomeSchema.safeParse(
				payload.outcome,
			);
			if (typeof payload.replayed !== "boolean" || !outcome.success) {
				throw new Error(
					"Managed Payment acknowledgement response was invalid.",
				);
			}
			return { replayed: payload.replayed, outcome: outcome.data };
		},
		async preparePaymentOption(input) {
			const response = await tokenClient.request(
				MANAGED_PAYMENTS_RESOURCE,
				"v1/workloads/payments/prepare",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(input),
				},
			);
			requireOk(response);
			const payload = await readJson(response);
			const parsed = managedPaymentPrepareResponseSchema.safeParse(payload);
			if (!parsed.success) {
				throw new Error("Managed Payment prepare response was invalid.");
			}
			return parsed.data;
		},
	};
}
