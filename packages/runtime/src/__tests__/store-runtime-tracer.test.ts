import { describe, expect, it } from "vitest";
import {
	type CommandAuthority,
	type CommandExecutionContext,
	createCommandExecutor,
	createInMemoryCommandPersistence,
} from "../command";
import { storeRuntimeTracerCommand } from "../commands/store-runtime-tracer";

const context: CommandExecutionContext = {
	principal: {
		type: "session",
		credentialId: "tracer-owner",
		sessionId: "tracer-session",
	},
};

const authority: CommandAuthority = {
	authorize: async () => ({
		ok: true,
		actor: { type: "account", id: "tracer-account" },
		authority: {
			id: "tracer-membership",
			type: "store_membership",
			role: "owner",
			permissions: ["store:update"],
			storeId: "store-authoritative",
		},
		target: { type: "store", id: "store-authoritative" },
	}),
	canRead: async () => true,
};

describe("Store Runtime tracer Command", () => {
	it("commits a Store-owned write through the Command executor", async () => {
		let nextId = 0;
		const executor = createCommandExecutor({
			plane: "store_runtime",
			definitions: [storeRuntimeTracerCommand],
			authority,
			persistence: createInMemoryCommandPersistence(),
			digestKey: "store-runtime-tracer-digest-key-0001",
			clock: () => new Date("2026-08-11T20:00:00.000Z"),
			createId: (kind) => `${kind}-${++nextId}`,
		});

		const first = await executor.execute(
			{
				command: { name: "store_runtime.tracer.write", version: 1 },
				idempotencyKey: "tracer-write-001",
				target: { type: "store", id: "untrusted-store-hint" },
				input: { value: "first-local-value" },
			},
			context,
		);
		expect(first).toMatchObject({
			ok: true,
			receipt: {
				status: "succeeded",
				result: {
					previousValue: null,
					value: "first-local-value",
					targetId: "store-authoritative",
				},
			},
		});

		const second = await executor.execute(
			{
				command: { name: "store_runtime.tracer.write", version: 1 },
				idempotencyKey: "tracer-write-002",
				target: { type: "store", id: "another-untrusted-hint" },
				input: { value: "second-local-value" },
			},
			context,
		);
		expect(second).toMatchObject({
			ok: true,
			receipt: {
				status: "succeeded",
				result: {
					previousValue: "first-local-value",
					value: "second-local-value",
					targetId: "store-authoritative",
				},
			},
		});
	});
});
