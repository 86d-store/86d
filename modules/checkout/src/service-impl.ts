import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { z } from "zod";
import {
	CheckoutMutationUnavailableError,
	CheckoutRevisionConflictError,
} from "./concurrency";
import type {
	CheckoutController,
	CheckoutLineItem,
	CheckoutSession,
} from "./service";

/** Default session TTL: 30 minutes */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

const checkoutAddressRecordSchema = z.object({
	firstName: z.string(),
	lastName: z.string(),
	company: z.string().optional(),
	line1: z.string(),
	line2: z.string().optional(),
	city: z.string(),
	state: z.string(),
	postalCode: z.string(),
	country: z.string(),
	phone: z.string().optional(),
});

const checkoutSessionRecordSchema = z.object({
	id: z.string(),
	revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).default(1),
	cartId: z.string().optional(),
	customerId: z.string().optional(),
	guestEmail: z.string().optional(),
	status: z.enum([
		"pending",
		"processing",
		"completed",
		"expired",
		"abandoned",
	]),
	subtotal: z.number(),
	taxAmount: z.number(),
	shippingAmount: z.number(),
	discountAmount: z.number(),
	giftCardAmount: z.number().default(0),
	storeCreditAmount: z.number().default(0),
	total: z.number(),
	currency: z.string(),
	discountCode: z.string().optional(),
	giftCardCode: z.string().optional(),
	shippingAddress: checkoutAddressRecordSchema.optional(),
	billingAddress: checkoutAddressRecordSchema.optional(),
	shippingMethodName: z.string().optional(),
	paymentMethod: z.string().optional(),
	paymentIntentId: z.string().optional(),
	paymentStatus: z.string().optional(),
	orderId: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	expiresAt: z.coerce.date(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

function parseCheckoutSession(value: Record<string, unknown>) {
	return checkoutSessionRecordSchema.parse(value);
}

type RevisionedCheckoutSession = ReturnType<typeof parseCheckoutSession>;

function sessionRecord(session: CheckoutSession): Record<string, unknown> {
	return { ...session };
}

function lineItemRecord(
	item: CheckoutLineItem & { sessionId: string },
): Record<string, unknown> {
	return { ...item };
}

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

/** Centralized total calculation — never negative */
function calculateTotal(session: {
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	storeCreditAmount: number;
}): number {
	return Math.max(
		0,
		session.subtotal +
			session.taxAmount +
			session.shippingAmount -
			session.discountAmount -
			session.giftCardAmount -
			session.storeCreditAmount,
	);
}

export function createCheckoutController(
	data: ModuleDataService,
	transactions?: ModuleTransactionRunner | undefined,
): CheckoutController {
	async function persistMutation(
		ownerData: ModuleDataService,
		stored: Record<string, unknown> | null,
		expectedRevision: number | undefined,
		mutate: (session: RevisionedCheckoutSession) => CheckoutSession | null,
	): Promise<CheckoutSession | null> {
		if (!stored) return null;

		const existing = parseCheckoutSession(stored);
		if (
			expectedRevision !== undefined &&
			existing.revision !== expectedRevision
		) {
			throw new CheckoutRevisionConflictError(existing.revision);
		}

		const next = mutate(existing);
		if (!next) return null;
		if (existing.revision >= Number.MAX_SAFE_INTEGER) {
			throw new CheckoutMutationUnavailableError();
		}

		const updated = {
			...next,
			revision: existing.revision + 1,
			updatedAt: new Date(),
		} satisfies CheckoutSession;
		await ownerData.upsert(
			"checkoutSession",
			existing.id,
			sessionRecord(updated),
		);
		return updated;
	}

	async function mutateSession(
		id: string,
		expectedRevision: number | undefined,
		mutate: (session: RevisionedCheckoutSession) => CheckoutSession | null,
	): Promise<CheckoutSession | null> {
		if (
			expectedRevision !== undefined &&
			(!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
		) {
			throw new CheckoutRevisionConflictError(1);
		}

		if (!transactions) {
			if (expectedRevision !== undefined) {
				throw new CheckoutMutationUnavailableError();
			}
			return persistMutation(
				data,
				await data.get("checkoutSession", id),
				expectedRevision,
				mutate,
			);
		}

		return transactions.transaction(async (transaction) => {
			if (!isLockingTransaction(transaction)) {
				if (expectedRevision !== undefined) {
					throw new CheckoutMutationUnavailableError();
				}
				return persistMutation(
					transaction,
					await transaction.get("checkoutSession", id),
					expectedRevision,
					mutate,
				);
			}

			return persistMutation(
				transaction,
				await transaction.getForUpdate("checkoutSession", id),
				expectedRevision,
				mutate,
			);
		});
	}

	return {
		async create(params): Promise<CheckoutSession> {
			const id = params.id ?? crypto.randomUUID();
			const now = new Date();
			const ttl = params.ttl ?? DEFAULT_TTL_MS;

			const session: CheckoutSession = {
				id,
				revision: 1,
				cartId: params.cartId,
				customerId: params.customerId,
				guestEmail: params.guestEmail,
				status: "pending",
				subtotal: params.subtotal,
				taxAmount: params.taxAmount ?? 0,
				shippingAmount: params.shippingAmount ?? 0,
				discountAmount: params.discountAmount ?? 0,
				giftCardAmount: 0,
				storeCreditAmount: params.storeCreditAmount ?? 0,
				total: params.total,
				currency: params.currency ?? "USD",
				shippingAddress: params.shippingAddress,
				billingAddress: params.billingAddress,
				metadata: params.metadata ?? {},
				expiresAt: new Date(now.getTime() + ttl),
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("checkoutSession", id, sessionRecord(session));

			// Store line items
			for (const item of params.lineItems) {
				const itemRecord = { ...item, sessionId: id };
				await data.upsert(
					"checkoutLineItem",
					`${id}_${item.productId}${item.variantId ? `_${item.variantId}` : ""}`,
					lineItemRecord(itemRecord),
				);
			}

			return session;
		},

		async getById(id: string): Promise<CheckoutSession | null> {
			const stored = await data.get("checkoutSession", id);
			return stored ? parseCheckoutSession(stored) : null;
		},

		async update(
			id: string,
			params,
			expectedRevision?: number | undefined,
		): Promise<CheckoutSession | null> {
			return mutateSession(id, expectedRevision, (existing) => {
				if (existing.status === "completed" || existing.status === "expired") {
					return null;
				}

				const merged = {
					...existing,
					...(params.guestEmail !== undefined
						? { guestEmail: params.guestEmail }
						: {}),
					...(params.shippingAddress !== undefined
						? { shippingAddress: params.shippingAddress }
						: {}),
					...(params.billingAddress !== undefined
						? { billingAddress: params.billingAddress }
						: {}),
					...(params.shippingAmount !== undefined
						? { shippingAmount: params.shippingAmount }
						: {}),
					...(params.shippingMethodName !== undefined
						? { shippingMethodName: params.shippingMethodName }
						: {}),
					...(params.taxAmount !== undefined
						? { taxAmount: params.taxAmount }
						: {}),
					...(params.paymentMethod !== undefined
						? { paymentMethod: params.paymentMethod }
						: {}),
					...(params.metadata !== undefined
						? { metadata: params.metadata }
						: {}),
				};

				const amountsChanged =
					params.shippingAmount !== undefined || params.taxAmount !== undefined;

				return {
					...merged,
					total: amountsChanged ? calculateTotal(merged) : merged.total,
				};
			});
		},

		async applyDiscount(
			id: string,
			params: { code: string; discountAmount: number; freeShipping: boolean },
			expectedRevision?: number | undefined,
		): Promise<CheckoutSession | null> {
			return mutateSession(id, expectedRevision, (existing) => {
				if (existing.status === "completed" || existing.status === "expired") {
					return null;
				}

				const shippingAmount = params.freeShipping
					? 0
					: existing.shippingAmount;
				return {
					...existing,
					discountCode: params.code,
					discountAmount: params.discountAmount,
					shippingAmount,
					total: calculateTotal({
						...existing,
						shippingAmount,
						discountAmount: params.discountAmount,
					}),
				};
			});
		},

		async removeDiscount(
			id: string,
			expectedRevision?: number | undefined,
		): Promise<CheckoutSession | null> {
			return mutateSession(id, expectedRevision, (existing) => {
				if (existing.status === "completed" || existing.status === "expired") {
					return null;
				}

				return {
					...existing,
					discountCode: undefined,
					discountAmount: 0,
					total: calculateTotal({
						...existing,
						discountAmount: 0,
					}),
				};
			});
		},

		async removeGiftCard(
			id: string,
			expectedRevision?: number | undefined,
		): Promise<CheckoutSession | null> {
			return mutateSession(id, expectedRevision, (existing) => {
				if (existing.status === "completed" || existing.status === "expired") {
					return null;
				}

				return {
					...existing,
					giftCardCode: undefined,
					giftCardAmount: 0,
					total: calculateTotal({
						...existing,
						giftCardAmount: 0,
					}),
				};
			});
		},

		async applyStoreCredit(
			id: string,
			params: { storeCreditAmount: number },
			expectedRevision?: number | undefined,
		): Promise<CheckoutSession | null> {
			return mutateSession(id, expectedRevision, (existing) => {
				if (existing.status === "completed" || existing.status === "expired") {
					return null;
				}

				return {
					...existing,
					storeCreditAmount: params.storeCreditAmount,
					total: calculateTotal({
						...existing,
						storeCreditAmount: params.storeCreditAmount,
					}),
				};
			});
		},

		async removeStoreCredit(
			id: string,
			expectedRevision?: number | undefined,
		): Promise<CheckoutSession | null> {
			return mutateSession(id, expectedRevision, (existing) => {
				if (existing.status === "completed" || existing.status === "expired") {
					return null;
				}

				return {
					...existing,
					storeCreditAmount: 0,
					total: calculateTotal({
						...existing,
						storeCreditAmount: 0,
					}),
				};
			});
		},

		async confirm(
			id: string,
		): Promise<
			{ session: CheckoutSession } | { error: string; status: number }
		> {
			const existing = (await data.get(
				"checkoutSession",
				id,
			)) as CheckoutSession | null;
			if (!existing) {
				return { error: "Checkout session not found", status: 404 };
			}
			if (existing.status !== "pending") {
				return {
					error: `Cannot confirm session in "${existing.status}" status`,
					status: 422,
				};
			}

			// Require customer identification
			if (!existing.customerId && !existing.guestEmail) {
				return {
					error: "Customer ID or guest email is required",
					status: 422,
				};
			}

			// Require shipping address
			if (!existing.shippingAddress) {
				return { error: "Shipping address is required", status: 422 };
			}

			// Require at least one line item
			const items = (await data.findMany("checkoutLineItem", {
				where: { sessionId: id },
			})) as Array<CheckoutLineItem & { sessionId: string }>;
			if (items.length === 0) {
				return {
					error: "Checkout session has no line items",
					status: 422,
				};
			}

			const updated: CheckoutSession = {
				...existing,
				status: "processing",
				updatedAt: new Date(),
			};

			await data.upsert("checkoutSession", id, sessionRecord(updated));
			return { session: updated };
		},

		async setPaymentIntent(
			id: string,
			intentId: string,
			status: string,
		): Promise<CheckoutSession | null> {
			const existing = (await data.get(
				"checkoutSession",
				id,
			)) as CheckoutSession | null;
			if (
				!existing ||
				existing.status === "completed" ||
				existing.status === "expired"
			) {
				return null;
			}

			const updated: CheckoutSession = {
				...existing,
				paymentIntentId: intentId,
				paymentStatus: status,
				updatedAt: new Date(),
			};

			await data.upsert("checkoutSession", id, sessionRecord(updated));
			return updated;
		},

		async complete(
			id: string,
			orderId: string,
		): Promise<CheckoutSession | null> {
			const existing = (await data.get(
				"checkoutSession",
				id,
			)) as CheckoutSession | null;
			if (
				!existing ||
				(existing.status !== "pending" && existing.status !== "processing")
			) {
				return null;
			}

			const updated: CheckoutSession = {
				...existing,
				status: "completed",
				orderId,
				updatedAt: new Date(),
			};

			await data.upsert("checkoutSession", id, sessionRecord(updated));
			return updated;
		},

		async abandon(
			id: string,
			expectedRevision?: number | undefined,
		): Promise<CheckoutSession | null> {
			return mutateSession(id, expectedRevision, (existing) => {
				if (existing.status === "completed") return null;
				return { ...existing, status: "abandoned" };
			});
		},

		async getLineItems(sessionId: string): Promise<CheckoutLineItem[]> {
			const results = (await data.findMany("checkoutLineItem", {
				where: { sessionId },
			})) as Array<CheckoutLineItem & { sessionId: string }>;

			return results.map(({ sessionId: _sid, ...item }) => item);
		},

		async listSessions(params: {
			status?: string | undefined;
			search?: string | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		}): Promise<{ sessions: CheckoutSession[]; total: number }> {
			const take = params.take ?? 20;
			const skip = params.skip ?? 0;

			const where: Record<string, string> = {};
			if (params.status) {
				where.status = params.status;
			}

			const findOpts: {
				orderBy: Record<string, "asc" | "desc">;
				where?: Record<string, string>;
			} = {
				orderBy: { createdAt: "desc" },
			};
			if (Object.keys(where).length > 0) {
				findOpts.where = where;
			}
			const allSessions = (await data.findMany(
				"checkoutSession",
				findOpts,
			)) as CheckoutSession[];

			// Client-side search filter (email or session ID prefix)
			let filtered = allSessions;
			if (params.search) {
				const q = params.search.toLowerCase();
				filtered = allSessions.filter(
					(s) =>
						s.id.toLowerCase().includes(q) ||
						s.guestEmail?.toLowerCase().includes(q) ||
						s.customerId?.toLowerCase().includes(q),
				);
			}

			const total = filtered.length;
			const sessions = filtered.slice(skip, skip + take);

			return { sessions, total };
		},

		async getStats(): Promise<{
			total: number;
			pending: number;
			processing: number;
			completed: number;
			abandoned: number;
			expired: number;
			conversionRate: number;
			totalRevenue: number;
			averageOrderValue: number;
		}> {
			const allSessions = (await data.findMany(
				"checkoutSession",
				{},
			)) as CheckoutSession[];

			const total = allSessions.length;
			let pending = 0;
			let processing = 0;
			let completed = 0;
			let abandoned = 0;
			let expired = 0;
			let totalRevenue = 0;

			for (const s of allSessions) {
				switch (s.status) {
					case "pending":
						pending++;
						break;
					case "processing":
						processing++;
						break;
					case "completed":
						completed++;
						totalRevenue += s.total;
						break;
					case "abandoned":
						abandoned++;
						break;
					case "expired":
						expired++;
						break;
				}
			}

			// Conversion rate: completed / (completed + abandoned + expired)
			const terminatedCount = completed + abandoned + expired;
			const conversionRate =
				terminatedCount > 0 ? completed / terminatedCount : 0;
			const averageOrderValue = completed > 0 ? totalRevenue / completed : 0;

			return {
				total,
				pending,
				processing,
				completed,
				abandoned,
				expired,
				conversionRate,
				totalRevenue,
				averageOrderValue,
			};
		},

		async expireStale(): Promise<{
			expired: number;
			processingSessions: CheckoutSession[];
		}> {
			const now = new Date();
			let expired = 0;
			const processingSessions: CheckoutSession[] = [];

			// Scan both pending and processing sessions for expiration
			for (const status of ["pending", "processing"] as const) {
				const all = (await data.findMany("checkoutSession", {
					where: { status },
				})) as CheckoutSession[];

				for (const session of all) {
					if (new Date(session.expiresAt) < now) {
						const updated: CheckoutSession = {
							...session,
							status: "expired",
							updatedAt: now,
						};
						await data.upsert(
							"checkoutSession",
							session.id,
							sessionRecord(updated),
						);
						if (status === "processing") {
							processingSessions.push(session);
						}
						expired++;
					}
				}
			}

			return { expired, processingSessions };
		},
	};
}
