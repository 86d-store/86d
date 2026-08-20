import { db } from "db";
import { ensureBooted } from "../lib/api-registry";
import { runDurableEventWorker } from "../lib/durable-event-worker";
import { drainDurableEventsBatch } from "../lib/durable-events";

const configuredMaxBatches = Number.parseInt(
	process.env.DURABLE_EVENT_MAX_BATCHES ?? "25",
	10,
);

try {
	const registry = await ensureBooted();
	const result = await runDurableEventWorker({
		drain: () => drainDurableEventsBatch(registry),
		maxBatches: configuredMaxBatches,
	});

	console.info(JSON.stringify({ worker: "durable-events", ...result }));
	if (result.failed > 0 || result.deadLettered > 0) process.exitCode = 1;
} catch (error) {
	console.error("Durable event worker failed", error);
	process.exitCode = 1;
} finally {
	await db.$disconnect();
}
