import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { NewsletterEmailProvider } from "./email-provider";
import type {
	Campaign,
	CampaignStats,
	CampaignStatus,
	NewsletterController,
	Subscriber,
} from "./service";

export function createNewsletterController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	emailProvider?: NewsletterEmailProvider | undefined,
): NewsletterController {
	return {
		async subscribe(params) {
			const now = new Date();

			// Check if email already exists using where clause
			const matches = await data.findMany("subscriber", {
				where: { email: params.email },
				take: 1,
			});
			const existing = matches[0] as Subscriber | undefined;

			if (existing) {
				// Already active — return as-is (idempotent)
				if (existing.status === "active") {
					return existing;
				}
				// Reactivate unsubscribed or bounced
				const updated: Subscriber = {
					...existing,
					status: "active",
					unsubscribedAt: undefined,
					updatedAt: now,
				};
				await data.upsert(
					"subscriber",
					existing.id,
					updated as Record<string, unknown>,
				);
				return updated;
			}

			const id = crypto.randomUUID();
			const subscriber: Subscriber = {
				id,
				email: params.email,
				firstName: params.firstName,
				lastName: params.lastName,
				status: "active",
				source: params.source,
				tags: params.tags ?? [],
				metadata: params.metadata ?? {},
				subscribedAt: now,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"subscriber",
				id,
				subscriber as Record<string, unknown>,
			);
			void events?.emit("newsletter.subscribed", {
				subscriberId: subscriber.id,
				email: subscriber.email,
				source: subscriber.source,
			});
			return subscriber;
		},

		async unsubscribe(email) {
			const matches = await data.findMany("subscriber", {
				where: { email },
				take: 1,
			});
			const existing = matches[0] as Subscriber | undefined;
			if (!existing) return null;

			const now = new Date();
			const updated: Subscriber = {
				...existing,
				status: "unsubscribed",
				unsubscribedAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"subscriber",
				existing.id,
				updated as Record<string, unknown>,
			);
			void events?.emit("newsletter.unsubscribed", {
				subscriberId: updated.id,
				email: updated.email,
			});
			return updated;
		},

		async resubscribe(email) {
			const matches = await data.findMany("subscriber", {
				where: { email },
				take: 1,
			});
			const existing = matches[0] as Subscriber | undefined;
			if (!existing) return null;

			const now = new Date();
			const updated: Subscriber = {
				...existing,
				status: "active",
				unsubscribedAt: undefined,
				updatedAt: now,
			};
			await data.upsert(
				"subscriber",
				existing.id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async getSubscriber(id) {
			const raw = await data.get("subscriber", id);
			if (!raw) return null;
			return raw as unknown as Subscriber;
		},

		async getSubscriberByEmail(email) {
			const matches = await data.findMany("subscriber", {
				where: { email },
				take: 1,
			});
			return (matches[0] as Subscriber) ?? null;
		},

		async updateSubscriber(id, params) {
			const existing = await data.get("subscriber", id);
			if (!existing) return null;

			const subscriber = existing as unknown as Subscriber;
			const updated: Subscriber = {
				...subscriber,
				...(params.firstName !== undefined
					? { firstName: params.firstName }
					: {}),
				...(params.lastName !== undefined ? { lastName: params.lastName } : {}),
				...(params.tags !== undefined ? { tags: params.tags } : {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("subscriber", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteSubscriber(id) {
			const existing = await data.get("subscriber", id);
			if (!existing) return false;
			await data.delete("subscriber", id);
			return true;
		},

		async listSubscribers(params) {
			// Build where filter for status when provided
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("subscriber", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			let subscribers = all as unknown as Subscriber[];

			// Tag filtering must remain client-side (array contains)
			if (params?.tag) {
				const tag = params.tag;
				subscribers = subscribers.filter((s) =>
					(s.tags as string[]).includes(tag),
				);
			}
			return subscribers;
		},

		// ── Campaign CRUD ───────────────────────────────────────────────

		async createCampaign(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const status: CampaignStatus = params.scheduledAt ? "scheduled" : "draft";
			const campaign: Campaign = {
				id,
				subject: params.subject,
				body: params.body,
				status,
				recipientCount: 0,
				sentCount: 0,
				failedCount: 0,
				tags: params.tags ?? [],
				scheduledAt: params.scheduledAt,
				sentAt: undefined,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("campaign", id, campaign as Record<string, unknown>);
			return campaign;
		},

		async getCampaign(id) {
			const raw = await data.get("campaign", id);
			if (!raw) return null;
			return raw as unknown as Campaign;
		},

		async updateCampaign(id, params) {
			const existing = await data.get("campaign", id);
			if (!existing) return null;

			const campaign = existing as unknown as Campaign;
			// Only draft/scheduled campaigns can be edited
			if (campaign.status === "sending" || campaign.status === "sent") {
				return null;
			}

			const updated: Campaign = {
				...campaign,
				...(params.subject !== undefined ? { subject: params.subject } : {}),
				...(params.body !== undefined ? { body: params.body } : {}),
				...(params.tags !== undefined ? { tags: params.tags } : {}),
				...(params.scheduledAt !== undefined
					? { scheduledAt: params.scheduledAt }
					: {}),
				status: params.scheduledAt ? "scheduled" : campaign.status,
				updatedAt: new Date(),
			};
			await data.upsert("campaign", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteCampaign(id) {
			const existing = await data.get("campaign", id);
			if (!existing) return false;
			const campaign = existing as unknown as Campaign;
			// Cannot delete a campaign that is currently sending
			if (campaign.status === "sending") return false;
			await data.delete("campaign", id);
			return true;
		},

		async listCampaigns(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("campaign", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Campaign[];
		},

		async sendCampaign(id) {
			const existing = await data.get("campaign", id);
			if (!existing) return null;

			const campaign = existing as unknown as Campaign;
			// Only draft or scheduled campaigns can be sent
			if (campaign.status === "sending" || campaign.status === "sent") {
				return null;
			}

			const activeSubscribers = await data.findMany("subscriber", {
				where: { status: "active" },
			});
			const subscribers = activeSubscribers as unknown as Subscriber[];
			const recipientCount = subscribers.length;

			// Mark as sending before dispatch
			const now = new Date();
			const sending: Campaign = {
				...campaign,
				status: "sending",
				recipientCount,
				updatedAt: now,
			};
			await data.upsert("campaign", id, sending as Record<string, unknown>);

			let sentCount = 0;
			let failedCount = 0;

			if (emailProvider && recipientCount > 0) {
				const result = await emailProvider.sendBatch(
					subscribers.map((s) => ({
						to: s.email,
						subject: campaign.subject,
						html: campaign.body,
					})),
					id,
				);
				sentCount = result.sent;
				failedCount = result.failed;
			}

			const sentAt = new Date();
			const updated: Campaign = {
				...campaign,
				status: "sent",
				recipientCount,
				sentCount,
				failedCount,
				sentAt,
				updatedAt: sentAt,
			};
			await data.upsert("campaign", id, updated as Record<string, unknown>);
			void events?.emit("newsletter.campaign.sent", {
				campaignId: updated.id,
				subject: updated.subject,
				recipientCount: updated.recipientCount,
			});
			return updated;
		},

		async getCampaignStats() {
			const all = await data.findMany("campaign", {});
			const campaigns = all as unknown as Campaign[];

			const stats: CampaignStats = {
				total: campaigns.length,
				draft: 0,
				scheduled: 0,
				sending: 0,
				sent: 0,
				totalRecipients: 0,
				totalSent: 0,
				totalFailed: 0,
			};

			for (const c of campaigns) {
				if (c.status === "draft") stats.draft++;
				else if (c.status === "scheduled") stats.scheduled++;
				else if (c.status === "sending") stats.sending++;
				else if (c.status === "sent") stats.sent++;
				stats.totalRecipients += c.recipientCount;
				stats.totalSent += c.sentCount;
				stats.totalFailed += c.failedCount;
			}

			return stats;
		},
	};
}
