import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Subscription,
	SubscriptionController,
	SubscriptionInterval,
	SubscriptionPlan,
	SubscriptionStatus,
} from "./service";

function calculateNextPeriod(
	interval: SubscriptionInterval,
	intervalCount: number,
	from?: Date,
): { start: Date; end: Date } {
	const start = from ?? new Date();
	const end = new Date(start);
	switch (interval) {
		case "day":
			end.setDate(end.getDate() + intervalCount);
			break;
		case "week":
			end.setDate(end.getDate() + intervalCount * 7);
			break;
		case "month":
			end.setMonth(end.getMonth() + intervalCount);
			break;
		case "year":
			end.setFullYear(end.getFullYear() + intervalCount);
			break;
	}
	return { start, end };
}

export function createSubscriptionController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): SubscriptionController {
	return {
		async createPlan(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const plan: SubscriptionPlan = {
				id,
				name: params.name,
				description: params.description,
				price: params.price,
				currency: params.currency ?? "USD",
				interval: params.interval,
				intervalCount: params.intervalCount ?? 1,
				trialDays: params.trialDays,
				isActive: params.isActive ?? true,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"subscriptionPlan",
				id,
				plan as Record<string, unknown>,
			);
			return plan;
		},

		async getPlan(id) {
			const raw = await data.get("subscriptionPlan", id);
			if (!raw) return null;
			return raw as unknown as SubscriptionPlan;
		},

		async listPlans(params) {
			const all = await data.findMany("subscriptionPlan", {
				...(params?.activeOnly ? { where: { isActive: true } } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as SubscriptionPlan[];
		},

		async updatePlan(id, params) {
			const existing = await data.get("subscriptionPlan", id);
			if (!existing) return null;
			const base = existing as unknown as SubscriptionPlan;
			const updated: SubscriptionPlan = {
				id: base.id,
				name: params.name !== undefined ? params.name : base.name,
				description:
					params.description !== undefined
						? params.description
						: base.description,
				price: params.price !== undefined ? params.price : base.price,
				currency: base.currency,
				interval: base.interval,
				intervalCount: base.intervalCount,
				trialDays:
					params.trialDays !== undefined ? params.trialDays : base.trialDays,
				isActive:
					params.isActive !== undefined ? params.isActive : base.isActive,
				createdAt: base.createdAt,
				updatedAt: new Date(),
			};
			await data.upsert(
				"subscriptionPlan",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async deletePlan(id) {
			await data.delete("subscriptionPlan", id);
			return true;
		},

		async subscribe(params) {
			const plan = await data.get("subscriptionPlan", params.planId);
			if (!plan) throw new Error("Plan not found");
			const p = plan as unknown as SubscriptionPlan;
			if (!p.isActive) throw new Error("Plan is not active");

			const id = crypto.randomUUID();
			const now = new Date();
			const { start, end } = calculateNextPeriod(p.interval, p.intervalCount);

			let status: SubscriptionStatus = "active";
			let trialStart: Date | undefined;
			let trialEnd: Date | undefined;

			if (p.trialDays && p.trialDays > 0) {
				status = "trialing";
				trialStart = now;
				trialEnd = new Date(now);
				trialEnd.setDate(trialEnd.getDate() + p.trialDays);
			}

			const sub: Subscription = {
				id,
				planId: params.planId,
				email: params.email,
				customerId: params.customerId,
				status,
				currentPeriodStart: start,
				currentPeriodEnd: end,
				trialStart,
				trialEnd,
				cancelAtPeriodEnd: false,
				...(params.paymentIntentId
					? { paymentIntentId: params.paymentIntentId }
					: {}),
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("subscription", id, sub as Record<string, unknown>);

			if (events) {
				void events.emit("subscription.created", {
					subscriptionId: sub.id,
					planId: sub.planId,
					planName: p.name,
					email: sub.email,
					customerId: sub.customerId,
					status: sub.status,
					interval: p.interval,
					price: p.price,
					currency: p.currency,
				});
			}

			return sub;
		},

		async getSubscription(id) {
			const raw = await data.get("subscription", id);
			if (!raw) return null;
			return raw as unknown as Subscription;
		},

		async getSubscriptionByEmail(params) {
			const where: Record<string, unknown> = { email: params.email };
			if (params.planId) where.planId = params.planId;

			const matches = await data.findMany("subscription", {
				where,
				take: 1,
			});
			return (matches[0] as Subscription | undefined) ?? null;
		},

		async cancelSubscription(params) {
			const existing = await data.get("subscription", params.id);
			if (!existing) return null;
			const sub = existing as unknown as Subscription;
			const now = new Date();

			let updated: Subscription;
			if (params.cancelAtPeriodEnd) {
				updated = { ...sub, cancelAtPeriodEnd: true, updatedAt: now };
			} else {
				updated = {
					...sub,
					status: "cancelled",
					cancelledAt: now,
					cancelAtPeriodEnd: false,
					updatedAt: now,
				};
			}
			await data.upsert(
				"subscription",
				params.id,
				updated as Record<string, unknown>,
			);

			if (events && updated.status === "cancelled") {
				void events.emit("subscription.cancelled", {
					subscriptionId: updated.id,
					planId: updated.planId,
					email: updated.email,
					customerId: updated.customerId,
					cancelledAt: updated.cancelledAt,
				});
			}

			return updated;
		},

		async renewSubscription(id) {
			const existing = await data.get("subscription", id);
			if (!existing) return null;
			const sub = existing as unknown as Subscription;
			const plan = await data.get("subscriptionPlan", sub.planId);
			if (!plan) return null;
			const p = plan as unknown as SubscriptionPlan;

			const { start, end } = calculateNextPeriod(
				p.interval,
				p.intervalCount,
				sub.currentPeriodEnd,
			);
			const updated: Subscription = {
				...sub,
				status: "active",
				currentPeriodStart: start,
				currentPeriodEnd: end,
				cancelAtPeriodEnd: false,
				updatedAt: new Date(),
			};
			await data.upsert("subscription", id, updated as Record<string, unknown>);

			if (events) {
				void events.emit("subscription.renewed", {
					subscriptionId: updated.id,
					planId: updated.planId,
					planName: p.name,
					email: updated.email,
					customerId: updated.customerId,
					currentPeriodStart: updated.currentPeriodStart,
					currentPeriodEnd: updated.currentPeriodEnd,
				});
			}

			return updated;
		},

		async expireSubscriptions() {
			// Fetch active/trialing subscriptions; date comparison stays client-side
			// (JSONB path equality can't express range queries)
			const activeSubs = await data.findMany("subscription", {
				where: { status: "active" },
			});
			const trialingSubs = await data.findMany("subscription", {
				where: { status: "trialing" },
			});
			const subs = [
				...(activeSubs as unknown as Subscription[]),
				...(trialingSubs as unknown as Subscription[]),
			];
			const now = new Date();
			let count = 0;
			for (const sub of subs) {
				if (
					(sub.status === "active" || sub.status === "trialing") &&
					sub.currentPeriodEnd < now
				) {
					const updated: Subscription = {
						...sub,
						status: "expired",
						updatedAt: now,
					};
					await data.upsert(
						"subscription",
						sub.id,
						updated as Record<string, unknown>,
					);
					count++;
				}
			}
			return count;
		},

		async listSubscriptions(params) {
			const where: Record<string, unknown> = {};
			if (params?.email) where.email = params.email;
			if (params?.planId) where.planId = params.planId;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("subscription", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Subscription[];
		},
	};
}
