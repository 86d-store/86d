import type { ModuleDataService } from "@86d-app/core/types/module";
import type { Announcement, AnnouncementsController } from "./service";

/**
 * Check whether an announcement is currently within its scheduled window.
 * Returns true if the current time is between startsAt and endsAt (inclusive).
 * Missing bounds are treated as unbounded.
 */
function isInScheduleWindow(announcement: Announcement, now: Date): boolean {
	if (announcement.startsAt && now < announcement.startsAt) {
		return false;
	}
	if (announcement.endsAt && now > announcement.endsAt) {
		return false;
	}
	return true;
}

export function createAnnouncementsControllers(
	data: ModuleDataService,
): AnnouncementsController {
	return {
		async createAnnouncement(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const announcement: Announcement = {
				id,
				title: params.title,
				content: params.content,
				type: params.type ?? "bar",
				position: params.position ?? "top",
				linkUrl: params.linkUrl ?? undefined,
				linkText: params.linkText ?? undefined,
				backgroundColor: params.backgroundColor ?? undefined,
				textColor: params.textColor ?? undefined,
				iconName: params.iconName ?? undefined,
				priority: params.priority ?? 0,
				isActive: true,
				isDismissible: params.isDismissible ?? true,
				startsAt: params.startsAt ?? undefined,
				endsAt: params.endsAt ?? undefined,
				targetAudience: params.targetAudience ?? "all",
				impressions: 0,
				clicks: 0,
				dismissals: 0,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};

			const record = announcement as Record<string, unknown>;
			await data.upsert("announcement", id, record);

			return announcement;
		},

		async getAnnouncement(id) {
			return (await data.get("announcement", id)) as Announcement | null;
		},

		async listAnnouncements(opts = {}) {
			const { activeOnly, type, position, limit, offset = 0 } = opts;

			const where: Record<string, unknown> = {};
			if (activeOnly) where.isActive = true;
			if (type) where.type = type;
			if (position) where.position = position;

			const all = (await data.findMany("announcement", {
				where,
			})) as Announcement[];

			// Sort by priority (ascending), then by createdAt (newest first)
			all.sort((a, b) => {
				if (a.priority !== b.priority) return a.priority - b.priority;
				return (
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			});

			const sliced = limit
				? all.slice(offset, offset + limit)
				: all.slice(offset);
			return sliced;
		},

		async getActiveAnnouncements(opts = {}) {
			const { audience } = opts;
			const now = new Date();

			const all = (await data.findMany("announcement", {
				where: { isActive: true },
			})) as Announcement[];

			const visible = all.filter((a) => {
				// Check schedule window
				if (!isInScheduleWindow(a, now)) return false;

				// Check audience targeting
				if (
					audience &&
					a.targetAudience !== "all" &&
					a.targetAudience !== audience
				)
					return false;

				return true;
			});

			// Sort by priority ascending
			visible.sort((a, b) => a.priority - b.priority);

			return visible;
		},

		async updateAnnouncement(id, updateData) {
			const existing = (await data.get(
				"announcement",
				id,
			)) as Announcement | null;

			if (!existing) {
				throw new Error(`Announcement ${id} not found`);
			}

			const updated: Announcement = {
				id: existing.id,
				title: updateData.title ?? existing.title,
				content: updateData.content ?? existing.content,
				type: updateData.type ?? existing.type,
				position: updateData.position ?? existing.position,
				linkUrl: updateData.linkUrl ?? existing.linkUrl,
				linkText: updateData.linkText ?? existing.linkText,
				backgroundColor: updateData.backgroundColor ?? existing.backgroundColor,
				textColor: updateData.textColor ?? existing.textColor,
				iconName: updateData.iconName ?? existing.iconName,
				priority: updateData.priority ?? existing.priority,
				isActive: updateData.isActive ?? existing.isActive,
				isDismissible: updateData.isDismissible ?? existing.isDismissible,
				startsAt: updateData.startsAt ?? existing.startsAt,
				endsAt: updateData.endsAt ?? existing.endsAt,
				targetAudience: updateData.targetAudience ?? existing.targetAudience,
				impressions: existing.impressions,
				clicks: existing.clicks,
				dismissals: existing.dismissals,
				metadata: existing.metadata,
				createdAt: existing.createdAt,
				updatedAt: new Date(),
			};

			await data.upsert("announcement", id, updated as Record<string, unknown>);

			return updated;
		},

		async deleteAnnouncement(id) {
			await data.delete("announcement", id);
		},

		async reorderAnnouncements(ids) {
			for (let i = 0; i < ids.length; i++) {
				const existing = (await data.get(
					"announcement",
					ids[i],
				)) as Announcement | null;

				if (existing) {
					const updated: Announcement = {
						...existing,
						priority: i,
						updatedAt: new Date(),
					};

					const rec = updated as Record<string, unknown>;
					await data.upsert("announcement", ids[i], rec);
				}
			}
		},

		async recordImpression(id) {
			const existing = (await data.get(
				"announcement",
				id,
			)) as Announcement | null;

			if (!existing) return;

			const updated: Announcement = {
				...existing,
				impressions: existing.impressions + 1,
				updatedAt: new Date(),
			};

			await data.upsert("announcement", id, updated as Record<string, unknown>);
		},

		async recordClick(id) {
			const existing = (await data.get(
				"announcement",
				id,
			)) as Announcement | null;

			if (!existing) return;

			const updated: Announcement = {
				...existing,
				clicks: existing.clicks + 1,
				updatedAt: new Date(),
			};

			await data.upsert("announcement", id, updated as Record<string, unknown>);
		},

		async recordDismissal(id) {
			const existing = (await data.get(
				"announcement",
				id,
			)) as Announcement | null;

			if (!existing) return;

			const updated: Announcement = {
				...existing,
				dismissals: existing.dismissals + 1,
				updatedAt: new Date(),
			};

			await data.upsert("announcement", id, updated as Record<string, unknown>);
		},

		async getStats() {
			const all = (await data.findMany("announcement", {})) as Announcement[];
			const now = new Date();

			let activeAnnouncements = 0;
			let scheduledAnnouncements = 0;
			let expiredAnnouncements = 0;
			let totalImpressions = 0;
			let totalClicks = 0;
			let totalDismissals = 0;

			for (const a of all) {
				totalImpressions += a.impressions;
				totalClicks += a.clicks;
				totalDismissals += a.dismissals;

				if (a.isActive && isInScheduleWindow(a, now)) {
					activeAnnouncements++;
				} else if (a.isActive && a.startsAt && now < a.startsAt) {
					scheduledAnnouncements++;
				} else if (a.endsAt && now > a.endsAt) {
					expiredAnnouncements++;
				}
			}

			const clickRate =
				totalImpressions > 0 ? totalClicks / totalImpressions : 0;
			const dismissRate =
				totalImpressions > 0 ? totalDismissals / totalImpressions : 0;

			return {
				totalAnnouncements: all.length,
				activeAnnouncements,
				scheduledAnnouncements,
				expiredAnnouncements,
				totalImpressions,
				totalClicks,
				totalDismissals,
				clickRate: Math.round(clickRate * 10000) / 10000,
				dismissRate: Math.round(dismissRate * 10000) / 10000,
			};
		},
	};
}
