import { computeCommandBindingHash } from "@86d-app/contracts/command";
import { z } from "zod";
import { defineCommand } from "../command";

export interface StoreRuntimeTracerTransaction {
	get(key: string): string | null;
	set(key: string, value: string): void;
}

/**
 * Small Store-owned Command used to prove the production Command path without
 * requiring a Control Plane, transport, or cross-plane persistence service.
 */
export const storeRuntimeTracerCommand =
	defineCommand<StoreRuntimeTracerTransaction>()({
		command: { name: "store_runtime.tracer.write", version: 1 },
		ownerPlane: "store_runtime",
		targetType: "store",
		actionLevel: "automatic",
		inputSchema: z
			.object({
				value: z.string().min(1).max(100),
			})
			.strict(),
		resultSchema: z
			.object({
				previousValue: z.string().nullable(),
				value: z.string(),
				targetId: z.string(),
			})
			.strict(),
		execute: async ({ input, target, transaction }) => {
			const stateKey = `command:tracer:${target.id}`;
			const previousValue = transaction.get(stateKey);
			transaction.set(stateKey, input.value);
			return {
				ok: true,
				result: {
					previousValue,
					value: input.value,
					targetId: target.id,
				},
			};
		},
	});

const reviewInputSchema = z
	.object({
		value: z.string().min(1).max(100),
		fail: z.boolean().optional(),
	})
	.strict();

const financialInputSchema = reviewInputSchema.extend({
	amount: z.string().regex(/^(?:0|[1-9]\d*)$/),
	currency: z.string().regex(/^[A-Z]{3}$/),
});

const gatedResultSchema = z
	.object({
		value: z.string(),
		targetId: z.string(),
	})
	.strict();

function executeGatedTracer<
	TInput extends {
		value: string;
		fail?: boolean | undefined;
	},
>(args: {
	input: TInput;
	target: { id: string };
	transaction: StoreRuntimeTracerTransaction;
}) {
	if (args.input.fail) {
		return Promise.resolve({
			ok: false as const,
			failure: {
				code: "execution_failed" as const,
				message: "The tracer requested a definite failure.",
				retryable: false,
			},
		});
	}
	args.transaction.set(`command:tracer:${args.target.id}`, args.input.value);
	return Promise.resolve({
		ok: true as const,
		result: { value: args.input.value, targetId: args.target.id },
	});
}

export const storeRuntimeApproveTracerCommand =
	defineCommand<StoreRuntimeTracerTransaction>()({
		command: { name: "store_runtime.tracer.approve", version: 1 },
		ownerPlane: "store_runtime",
		targetType: "store",
		actionLevel: "approve",
		admissionPolicy: { kind: "approval" },
		inputSchema: reviewInputSchema,
		resultSchema: gatedResultSchema,
		resolveGrantFacts: ({ inputDigest, target, transaction }) => {
			const disclosure = "Publish the reviewed Store Runtime tracer value.";
			return {
				bindingHashVersion: 1,
				disclosure,
				bindingHash: computeCommandBindingHash({
					bindingHashVersion: 1,
					plane: "store_runtime",
					command: { name: "store_runtime.tracer.approve", version: 1 },
					target,
					inputDigest,
					disclosure,
				}),
				businessId: "business-authoritative",
				storeId: target.id,
				baseRevisions: [
					{
						target,
						revision:
							transaction.get(`command:tracer:revision:${target.id}`) ??
							"revision-001",
					},
				],
			};
		},
		execute: executeGatedTracer,
	});

export const storeRuntimeFreshConfirmationTracerCommand =
	defineCommand<StoreRuntimeTracerTransaction>()({
		command: { name: "store_runtime.tracer.confirm_fresh", version: 1 },
		ownerPlane: "store_runtime",
		targetType: "store",
		actionLevel: "confirm_now",
		admissionPolicy: {
			kind: "confirmation",
			standingPermission: "forbidden",
			freshOnly: true,
		},
		inputSchema: reviewInputSchema,
		resultSchema: gatedResultSchema,
		resolveGrantFacts: ({ inputDigest, target }) => {
			const disclosure = "Apply the critical Store Runtime tracer change now.";
			return {
				bindingHashVersion: 1,
				disclosure,
				bindingHash: computeCommandBindingHash({
					bindingHashVersion: 1,
					plane: "store_runtime",
					command: {
						name: "store_runtime.tracer.confirm_fresh",
						version: 1,
					},
					target,
					inputDigest,
					disclosure,
				}),
				businessId: "business-authoritative",
				storeId: target.id,
				baseRevisions: undefined,
			};
		},
		execute: executeGatedTracer,
	});

export const storeRuntimeStandingPermissionTracerCommand =
	defineCommand<StoreRuntimeTracerTransaction>()({
		command: { name: "store_runtime.tracer.standing", version: 1 },
		ownerPlane: "store_runtime",
		targetType: "store",
		actionLevel: "confirm_now",
		admissionPolicy: {
			kind: "confirmation",
			standingPermission: "allowed",
			freshOnly: false,
		},
		inputSchema: financialInputSchema,
		resultSchema: gatedResultSchema,
		resolveGrantFacts: ({ input, inputDigest, target }) => {
			const disclosure = `Spend ${input.amount} ${input.currency} on the Store Runtime tracer.`;
			return {
				bindingHashVersion: 1,
				disclosure,
				bindingHash: computeCommandBindingHash({
					bindingHashVersion: 1,
					plane: "store_runtime",
					command: { name: "store_runtime.tracer.standing", version: 1 },
					target,
					inputDigest,
					disclosure,
					amount: input.amount,
					currency: input.currency,
				}),
				amount: input.amount,
				currency: input.currency,
				businessId: "business-authoritative",
				storeId: target.id,
				baseRevisions: undefined,
			};
		},
		execute: executeGatedTracer,
	});
