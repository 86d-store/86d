export type DurableEventDrainResult = Readonly<{
	claimed: number;
	succeeded: number;
	failed: number;
	deadLettered: number;
}>;

export type DurableEventWorkerResult = DurableEventDrainResult &
	Readonly<{
		batches: number;
		exhausted: boolean;
	}>;

export async function runDurableEventWorker(options: {
	drain: () => Promise<DurableEventDrainResult>;
	maxBatches: number;
}): Promise<DurableEventWorkerResult> {
	if (!Number.isSafeInteger(options.maxBatches) || options.maxBatches < 1) {
		throw new Error("maxBatches must be a positive safe integer.");
	}

	const total = {
		batches: 0,
		claimed: 0,
		succeeded: 0,
		failed: 0,
		deadLettered: 0,
		exhausted: false,
	};

	for (let batch = 0; batch < options.maxBatches; batch += 1) {
		const result = await options.drain();
		total.batches += 1;
		total.claimed += result.claimed;
		total.succeeded += result.succeeded;
		total.failed += result.failed;
		total.deadLettered += result.deadLettered;

		if (result.claimed === 0) return total;
	}

	total.exhausted = true;
	return total;
}
