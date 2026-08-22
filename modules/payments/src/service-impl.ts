import type {
	ModuleContext,
	ModuleDataService,
} from "@86d-app/core/types/module";
import { getProcessEnv } from "env/process-env";
import type {
	PaymentController,
	PaymentIntent,
	PaymentIntentStatus,
	PaymentMethod,
	PaymentProvider,
	Refund,
} from "./service";

export function createPaymentController(
	data: ModuleDataService,
	provider?: PaymentProvider,
	options?: {
		allowOfflineForDevelopment?: boolean | undefined;
		coreMoney?: ModuleContext["coreMoney"];
	},
): PaymentController {
	const allowOffline =
		options?.allowOfflineForDevelopment === true &&
		getProcessEnv("NODE_ENV") !== "production";
	const coreMoney = options?.coreMoney;
	/** Sum of all succeeded refund amounts for an intent. */
	async function totalRefunded(intentId: string): Promise<number> {
		const refunds = await data.findMany("refund", {
			where: { paymentIntentId: intentId },
		});
		return (refunds as unknown as Refund[]).reduce(
			(sum, r) => sum + (r.status !== "failed" ? r.amount : 0),
			0,
		);
	}

	return {
		async createIntent(params) {
			if (!Number.isInteger(params.amount) || params.amount <= 0) {
				throw new Error("Amount must be a positive integer");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			let providerIntentId: string | undefined;
			let providerMetadata: Record<string, unknown> = {};
			let status: PaymentIntentStatus = "pending";

			if (provider) {
				const result = await provider.createIntent({
					amount: params.amount,
					currency: params.currency ?? "USD",
					metadata: params.metadata,
				});
				providerIntentId = result.providerIntentId;
				providerMetadata = result.providerMetadata ?? {};
				status = result.status;
			}

			const intent: PaymentIntent = {
				id,
				providerIntentId,
				customerId: params.customerId,
				email: params.email,
				amount: params.amount,
				currency: params.currency ?? "USD",
				status,
				orderId: params.orderId,
				checkoutSessionId: params.checkoutSessionId,
				metadata: params.metadata ?? {},
				providerMetadata,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("paymentIntent", id, intent as Record<string, unknown>);
			return intent;
		},

		async getIntent(id) {
			const raw = await data.get("paymentIntent", id);
			if (!raw) return null;
			return raw as unknown as PaymentIntent;
		},

		async confirmIntent(id) {
			const existing = await data.get("paymentIntent", id);
			if (!existing) return null;
			const intent = existing as unknown as PaymentIntent;
			if ((!provider || !intent.providerIntentId) && !allowOffline) {
				throw new Error("Payment provider is not configured");
			}
			if (intent.status === "succeeded") return intent;

			const terminalStates: PaymentIntentStatus[] = [
				"cancelled",
				"failed",
				"refunded",
			];
			if (terminalStates.includes(intent.status)) {
				throw new Error(`Cannot confirm intent in '${intent.status}' state`);
			}

			let newStatus: PaymentIntentStatus = "succeeded";
			let newProviderMetadata = intent.providerMetadata;

			if (provider && intent.providerIntentId) {
				const result = await provider.confirmIntent(intent.providerIntentId);
				newStatus = result.status === "succeeded" ? "succeeded" : result.status;
				newProviderMetadata = result.providerMetadata ?? newProviderMetadata;
			}

			const updated: PaymentIntent = {
				...intent,
				status: newStatus,
				providerMetadata: newProviderMetadata,
				updatedAt: new Date(),
			};
			await data.upsert(
				"paymentIntent",
				id,
				updated as Record<string, unknown>,
			);
			if (newStatus === "succeeded" && coreMoney) {
				const partyId =
					intent.customerId &&
					/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
						intent.customerId,
					)
						? intent.customerId
						: id;
				await coreMoney.write({
					party: {
						id: partyId,
						kind: "person",
						email: intent.email ?? null,
					},
					subject: {
						id,
						kind: "payment",
						ownerModule: "payments",
						partyId,
						currency: intent.currency,
						expectedMinor: intent.amount,
						settleState: "settled",
					},
					transaction: {
						id,
						subjectId: id,
						authorizedMinor: intent.amount,
						capturedMinor: intent.amount,
						refundedMinor: 0,
					},
				});
			}
			return updated;
		},

		async cancelIntent(id) {
			const existing = await data.get("paymentIntent", id);
			if (!existing) return null;
			const intent = existing as unknown as PaymentIntent;
			if (intent.status === "cancelled") return intent;

			const nonCancellable: PaymentIntentStatus[] = [
				"succeeded",
				"failed",
				"refunded",
			];
			if (nonCancellable.includes(intent.status)) {
				throw new Error(`Cannot cancel intent in '${intent.status}' state`);
			}

			let newProviderMetadata = intent.providerMetadata;

			if (provider && intent.providerIntentId) {
				const result = await provider.cancelIntent(intent.providerIntentId);
				newProviderMetadata = result.providerMetadata ?? newProviderMetadata;
			}

			const updated: PaymentIntent = {
				...intent,
				status: "cancelled",
				providerMetadata: newProviderMetadata,
				updatedAt: new Date(),
			};
			await data.upsert(
				"paymentIntent",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async listIntents(params) {
			// Push available filters to where clause
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.status) where.status = params.status;
			if (params?.orderId) where.orderId = params.orderId;

			const all = await data.findMany("paymentIntent", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as PaymentIntent[];
		},

		async savePaymentMethod(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			// If isDefault is set, clear other defaults for this customer
			if (params.isDefault) {
				const existing = await data.findMany("paymentMethod", {
					where: { customerId: params.customerId, isDefault: true },
				});
				const methods = existing as unknown as PaymentMethod[];
				for (const m of methods) {
					const cleared: PaymentMethod = {
						...m,
						isDefault: false,
						updatedAt: now,
					};
					await data.upsert(
						"paymentMethod",
						m.id,
						cleared as unknown as Record<string, unknown>,
					);
				}
			}

			const method: PaymentMethod = {
				id,
				customerId: params.customerId,
				providerMethodId: params.providerMethodId,
				type: params.type ?? "card",
				last4: params.last4,
				brand: params.brand,
				expiryMonth: params.expiryMonth,
				expiryYear: params.expiryYear,
				isDefault: params.isDefault ?? false,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("paymentMethod", id, method as Record<string, unknown>);
			return method;
		},

		async getPaymentMethod(id) {
			const raw = await data.get("paymentMethod", id);
			if (!raw) return null;
			return raw as unknown as PaymentMethod;
		},

		async listPaymentMethods(customerId) {
			const all = await data.findMany("paymentMethod", {
				where: { customerId },
			});
			return all as unknown as PaymentMethod[];
		},

		async deletePaymentMethod(id) {
			const existing = await data.get("paymentMethod", id);
			if (!existing) return false;
			await data.delete("paymentMethod", id);
			return true;
		},

		async createRefund(params) {
			const intent = await data.get("paymentIntent", params.intentId);
			if (!intent) throw new Error("Payment intent not found");
			const pi = intent as unknown as PaymentIntent;

			const refundableStates: PaymentIntentStatus[] = ["succeeded", "refunded"];
			if (!refundableStates.includes(pi.status)) {
				throw new Error(`Cannot refund intent in '${pi.status}' state`);
			}

			const refundAmount = params.amount ?? pi.amount;
			if (refundAmount <= 0) {
				throw new Error("Refund amount must be positive");
			}

			const alreadyRefunded = await totalRefunded(params.intentId);
			if (alreadyRefunded + refundAmount > pi.amount) {
				throw new Error(
					`Refund amount ${refundAmount} exceeds remaining refundable amount ${pi.amount - alreadyRefunded}`,
				);
			}

			let providerRefundId: string;
			let refundStatus: Refund["status"] = "succeeded";

			if (provider && pi.providerIntentId) {
				const result = await provider.createRefund({
					providerIntentId: pi.providerIntentId,
					amount: params.amount,
					currency: pi.currency,
					reason: params.reason,
				});
				providerRefundId = result.providerRefundId;
				refundStatus = result.status;
			} else if (allowOffline) {
				providerRefundId = `local_re_${crypto.randomUUID()}`;
			} else {
				throw new Error("Payment provider is not configured");
			}

			const id = crypto.randomUUID();
			const now = new Date();
			const refund: Refund = {
				id,
				paymentIntentId: params.intentId,
				providerRefundId,
				amount: refundAmount,
				reason: params.reason,
				status: refundStatus,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("refund", id, refund as Record<string, unknown>);

			// Mark intent as refunded
			const updatedIntent: PaymentIntent = {
				...pi,
				status: "refunded",
				updatedAt: now,
			};
			await data.upsert(
				"paymentIntent",
				params.intentId,
				updatedIntent as unknown as Record<string, unknown>,
			);

			return refund;
		},

		async getRefund(id) {
			const raw = await data.get("refund", id);
			if (!raw) return null;
			return raw as unknown as Refund;
		},

		async listRefunds(intentId) {
			const all = await data.findMany("refund", {
				where: { paymentIntentId: intentId },
			});
			return all as unknown as Refund[];
		},

		async handleWebhookEvent(params) {
			const all = await data.findMany("paymentIntent", {
				where: { providerIntentId: params.providerIntentId },
				take: 1,
			});
			const intents = all as unknown as PaymentIntent[];
			if (intents.length === 0) return null;

			const intent = intents[0];
			if (intent.status === params.status) return null;

			const updated: PaymentIntent = {
				...intent,
				status: params.status,
				providerMetadata: {
					...intent.providerMetadata,
					...(params.providerMetadata ?? {}),
				},
				updatedAt: new Date(),
			};
			await data.upsert(
				"paymentIntent",
				intent.id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async handleWebhookRefund(params) {
			const all = await data.findMany("paymentIntent", {
				where: { providerIntentId: params.providerIntentId },
				take: 1,
			});
			const intents = all as unknown as PaymentIntent[];
			if (intents.length === 0) return null;

			const intent = intents[0];
			const now = new Date();
			const refundAmount = params.amount ?? intent.amount;

			// Deduplicate by providerRefundId — webhook retries must be idempotent
			const existingRefunds = await data.findMany("refund", {
				where: {
					paymentIntentId: intent.id,
					providerRefundId: params.providerRefundId,
				},
			});
			const existing = existingRefunds as unknown as Refund[];
			if (existing.length > 0) {
				return null;
			}

			const refundId = crypto.randomUUID();
			const refund: Refund = {
				id: refundId,
				paymentIntentId: intent.id,
				providerRefundId: params.providerRefundId,
				amount: refundAmount,
				reason: params.reason,
				status: "succeeded",
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("refund", refundId, refund as Record<string, unknown>);

			const updatedIntent: PaymentIntent = {
				...intent,
				status: "refunded",
				updatedAt: now,
			};
			await data.upsert(
				"paymentIntent",
				intent.id,
				updatedIntent as unknown as Record<string, unknown>,
			);

			return { intent: updatedIntent, refund };
		},
	};
}
