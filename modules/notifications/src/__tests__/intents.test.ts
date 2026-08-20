import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { NotificationIntentInput } from "../intents";
import {
	createNotificationIntentStore,
	notificationIntentInputSchema,
} from "../intents";

const localIntent = {
	idempotencyKey: "order-confirmation:order-1",
	sourceEventId: "event-order-completed-1",
	sourceModule: "orders",
	templateKey: "order-confirmation-v1",
	channel: "email",
	recipient: "shopper@example.com",
	deliveryMode: "local",
	payload: { orderNumber: "1001", totalMinor: 2_500, currency: "USD" },
} satisfies NotificationIntentInput;

describe("durable Store notification intents", () => {
	it("survives a process restart and replays without dispatch or duplication", async () => {
		const transactions = createMockTransactionRunner();
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const firstProcess = createNotificationIntentStore(transactions);
		const first = await firstProcess.enqueue(localIntent);
		const restartedProcess = createNotificationIntentStore(transactions);
		const replay = await restartedProcess.enqueue(localIntent);

		expect(first).toMatchObject({
			ok: true,
			replayed: false,
			intent: {
				status: "pending",
				attempts: 0,
				acceptedRecipientUnits: 0,
			},
		});
		expect(replay).toMatchObject({ ok: true, replayed: true });
		expect(transactions.data.all("notificationIntent")).toHaveLength(1);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});

	it("rejects reuse of a delivery identity for different recipient data", async () => {
		const store = createNotificationIntentStore(createMockTransactionRunner());
		await store.enqueue(localIntent);

		await expect(
			store.enqueue({ ...localIntent, recipient: "other@example.com" }),
		).resolves.toMatchObject({
			ok: false,
			code: "IDEMPOTENCY_KEY_REUSED",
		});
	});

	it("requires a managed Communications Connection for managed delivery", () => {
		expect(
			notificationIntentInputSchema.safeParse({
				...localIntent,
				deliveryMode: "managed_gateway",
			}).success,
		).toBe(false);
		expect(
			notificationIntentInputSchema.safeParse({
				...localIntent,
				deliveryMode: "managed_gateway",
				connectionId: "managed-communications-connection",
			}).success,
		).toBe(true);
	});
});
