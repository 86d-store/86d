import type {
	AnyDurableEventDefinition,
	DurableEventInput,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { createMockDataService } from "@86d-app/core/test-utils";

export type RecordedDurableEvent = Readonly<{
	definition: AnyDurableEventDefinition;
	input: DurableEventInput<AnyDurableEventDefinition>;
}>;

export function createTransactionTestStore(options?: {
	locking?: boolean | undefined;
}) {
	const data = createMockDataService();
	const events: RecordedDurableEvent[] = [];
	let eventSequence = 0;
	let queue = Promise.resolve();

	const transaction: ModuleDataTransaction = {
		get: data.get.bind(data),
		upsert: data.upsert.bind(data),
		delete: data.delete.bind(data),
		findMany: data.findMany.bind(data),
		async emit(definition, input) {
			eventSequence += 1;
			events.push({ definition, input });
			return {
				id: `event-${eventSequence}`,
				name: definition.name,
				version: definition.version,
				storeId: "store-1",
				sourceModule: definition.owner,
				aggregate: { ...input.aggregate, sequence: eventSequence },
				occurredAt: input.occurredAt ?? new Date(),
				payload: input.payload,
			};
		},
	};

	const lockingTransaction = {
		...transaction,
		getForUpdate: data.get.bind(data),
	};
	const activeTransaction =
		options?.locking === false ? transaction : lockingTransaction;
	const transactions: ModuleTransactionRunner = {
		transaction(work) {
			const result = queue.then(() => work(activeTransaction));
			queue = result.then(
				() => undefined,
				() => undefined,
			);
			return result;
		},
	};

	return { data, events, transactions };
}
