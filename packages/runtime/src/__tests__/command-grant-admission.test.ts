import { computeCommandBindingHash } from "@86d-app/contracts/command";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	type CommandAuthority,
	createCommandExecutor,
	createInMemoryCommandPersistence,
	defineCommand,
	type MemoryCommandTransaction,
} from "../command";
import type { CommandGrantAdapter } from "../grants";

const principal = {
	principal: {
		type: "session" as const,
		credentialId: "session-owner",
		sessionId: "session-human-present",
	},
};

const authority: CommandAuthority = {
	authorize: async () => ({
		ok: true,
		actor: { type: "account", id: "account-owner" },
		authority: {
			id: "membership-owner",
			type: "store_membership",
			permissions: ["store:update"],
			businessId: "business-001",
			storeId: "store-001",
		},
		target: { type: "store", id: "store-001" },
	}),
	canRead: async () => true,
};

function request(idempotencyKey: string, approvalReference: string) {
	return {
		command: { name: "store_runtime.tracer.approve", version: 1 },
		idempotencyKey,
		target: { type: "store", id: "store-client-hint" },
		input: { value: "approved" },
		approvalReference,
	};
}

function command(options?: {
	bindingHash?: string;
	amount?: string;
	currency?: string;
}) {
	return defineCommand<MemoryCommandTransaction>()({
		command: { name: "store_runtime.tracer.approve", version: 1 },
		ownerPlane: "store_runtime",
		targetType: "store",
		actionLevel: "approve",
		admissionPolicy: { kind: "approval" },
		inputSchema: z.object({ value: z.string() }).strict(),
		resultSchema: z.object({ value: z.string() }).strict(),
		resolveGrantFacts: async ({ inputDigest, target }) => {
			const disclosure = "Publish the tracer value";
			return {
				bindingHashVersion: 1,
				bindingHash:
					options?.bindingHash ??
					computeCommandBindingHash({
						bindingHashVersion: 1,
						plane: "store_runtime",
						command: { name: "store_runtime.tracer.approve", version: 1 },
						target,
						inputDigest,
						disclosure,
					}),
				disclosure,
				businessId: "business-001",
				storeId: "store-001",
				...(options?.amount === undefined
					? {}
					: { amount: options.amount, currency: options.currency }),
				baseRevisions: [
					{
						target: { type: "store", id: "store-001" },
						revision: "revision-001",
					},
				],
			};
		},
		execute: async ({ input, transaction }) => {
			transaction.set("tracer", input.value);
			return { ok: true, result: { value: input.value } };
		},
	});
}

describe("Command grant admission ordering", () => {
	it("rejects invalid grant terms at the defined Command interface", async () => {
		const definition = command({
			bindingHash: "a".repeat(64),
			amount: "-1",
			currency: "USD",
		});

		await expect(
			definition.resolveGrantFacts({
				actor: { type: "account", id: "account-owner" },
				authority: {
					id: "membership-owner",
					type: "store_membership",
					permissions: ["store:update"],
					businessId: "business-001",
					storeId: "store-001",
				},
				target: { type: "store", id: "store-001" },
				input: { value: "approved" },
				inputDigest: "b".repeat(64),
				transaction: {
					get: () => null,
					set: () => undefined,
					delete: () => undefined,
				},
			}),
		).rejects.toThrow("grant facts are invalid");
	});

	it("rejects a mismatched binding hash before grant admission", async () => {
		let admissions = 0;
		const definition = command();
		definition.resolveGrantFacts = async () => ({
			bindingHashVersion: 1,
			bindingHash: "a".repeat(64),
			disclosure: "Publish the tracer value",
			businessId: "business-001",
			storeId: "store-001",
			baseRevisions: [
				{
					target: { type: "store", id: "store-001" },
					revision: "revision-001",
				},
			],
		});
		const grants: CommandGrantAdapter<MemoryCommandTransaction> = {
			admit: async (_transaction, admission) => {
				admissions += 1;
				return {
					ok: true,
					grantUse: {
						kind: "approval",
						approvalId: admission.approvalReference ?? "missing",
						changeSetId: "change-set-001",
						reviewHash: "b".repeat(64),
					},
				};
			},
			settle: async () => undefined,
			markAmbiguous: async () => undefined,
		};
		const executor = createCommandExecutor({
			plane: "store_runtime",
			definitions: [definition],
			authority,
			persistence: createInMemoryCommandPersistence({ grants }),
			digestKey: "grant-admission-digest-key-at-least-32-bytes",
		});

		await expect(
			executor.execute(
				request("approval-binding-001", "approval-001"),
				principal,
			),
		).rejects.toThrow("binding hash");
		expect(admissions).toBe(0);
	});

	it("shares one validated fact snapshot with the admitting adapter", async () => {
		let factResolutions = 0;
		const definition = command();
		const resolveGrantFacts = definition.resolveGrantFacts.bind(definition);
		definition.resolveGrantFacts = async (args) => {
			factResolutions += 1;
			return resolveGrantFacts(args);
		};
		const grants: CommandGrantAdapter<MemoryCommandTransaction> = {
			admit: async (transaction, admission) => {
				const facts = await admission.resolveFacts(transaction);
				expect(facts.bindingHash).toMatch(/^[a-f0-9]{64}$/);
				return {
					ok: true,
					grantUse: {
						kind: "approval",
						approvalId: admission.approvalReference ?? "missing",
						changeSetId: "change-set-001",
						reviewHash: "b".repeat(64),
					},
				};
			},
			settle: async () => undefined,
			markAmbiguous: async () => undefined,
		};
		const executor = createCommandExecutor({
			plane: "store_runtime",
			definitions: [definition],
			authority,
			persistence: createInMemoryCommandPersistence({ grants }),
			digestKey: "grant-admission-digest-key-at-least-32-bytes",
		});

		await expect(
			executor.execute(
				request("approval-facts-001", "approval-001"),
				principal,
			),
		).resolves.toMatchObject({ ok: true });
		expect(factResolutions).toBe(1);
	});

	it("admits once after an idempotency claim and replays without consuming again", async () => {
		let admissions = 0;
		const grants: CommandGrantAdapter<MemoryCommandTransaction> = {
			admit: async (_transaction, admission) => {
				admissions += 1;
				return admissions === 1
					? {
							ok: true,
							grantUse: {
								kind: "approval",
								approvalId: admission.approvalReference ?? "missing",
								changeSetId: "change-set-001",
								reviewHash: "b".repeat(64),
							},
						}
					: {
							ok: false,
							failure: {
								code: "approval_invalid",
								message: "Approval was already consumed.",
								retryable: false,
							},
						};
			},
			settle: async () => undefined,
			markAmbiguous: async () => undefined,
		};
		const executor = createCommandExecutor({
			plane: "store_runtime",
			definitions: [command()],
			authority,
			persistence: createInMemoryCommandPersistence({ grants }),
			digestKey: "grant-admission-digest-key-at-least-32-bytes",
		});

		const first = await executor.execute(
			request("approval-replay-001", "approval-001"),
			principal,
		);
		const replay = await executor.execute(
			request("approval-replay-001", "different-valid-reference"),
			principal,
		);

		expect(first.ok).toBe(true);
		expect(replay).toMatchObject({
			ok: true,
			receipt: { replayed: true },
		});
		expect(admissions).toBe(1);
	});

	it("rolls back a denied claim so the same request can retry with a valid grant", async () => {
		let admissions = 0;
		let executions = 0;
		const grants: CommandGrantAdapter<MemoryCommandTransaction> = {
			admit: async () => {
				admissions += 1;
				return admissions === 1
					? {
							ok: false,
							failure: {
								code: "approval_invalid",
								message: "Approval does not match.",
								retryable: false,
							},
						}
					: {
							ok: true,
							grantUse: {
								kind: "approval",
								approvalId: "approval-valid",
								changeSetId: "change-set-001",
								reviewHash: "b".repeat(64),
							},
						};
			},
			settle: async () => undefined,
			markAmbiguous: async () => undefined,
		};
		const tracer = command();
		const originalExecute = tracer.execute;
		tracer.execute = async (input) => {
			executions += 1;
			return originalExecute(input);
		};
		const executor = createCommandExecutor({
			plane: "store_runtime",
			definitions: [tracer],
			authority,
			persistence: createInMemoryCommandPersistence({ grants }),
			digestKey: "grant-admission-digest-key-at-least-32-bytes",
		});

		const denied = await executor.execute(
			request("approval-retry-001", "approval-invalid"),
			principal,
		);
		const retried = await executor.execute(
			request("approval-retry-001", "approval-valid"),
			principal,
		);

		expect(denied).toMatchObject({
			ok: false,
			failure: { code: "approval_invalid" },
		});
		expect(retried.ok).toBe(true);
		expect(admissions).toBe(2);
		expect(executions).toBe(1);
	});
});
