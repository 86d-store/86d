import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	ShareEvent,
	ShareSettings,
	SocialSharingController,
} from "./service";

const SETTINGS_ID = "global";

export function createSocialSharingController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): SocialSharingController {
	return {
		async recordShare(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const shareEvent: ShareEvent = {
				id,
				targetType: params.targetType,
				targetId: params.targetId,
				network: params.network,
				url: params.url,
				referrer: params.referrer,
				sessionId: params.sessionId,
				createdAt: now,
			};
			await data.upsert(
				"shareEvent",
				id,
				shareEvent as Record<string, unknown>,
			);
			void events?.emit("share.created", {
				shareEventId: shareEvent.id,
				targetType: shareEvent.targetType,
				targetId: shareEvent.targetId,
				network: shareEvent.network,
			});
			return shareEvent;
		},

		async getShareCount(targetType, targetId) {
			const all = await data.findMany("shareEvent", {
				where: { targetType, targetId },
			});
			return all.length;
		},

		async getShareCountByNetwork(targetType, targetId) {
			const all = await data.findMany("shareEvent", {
				where: { targetType, targetId },
			});
			const counts: Record<string, number> = {};
			for (const raw of all) {
				const event = raw as unknown as ShareEvent;
				counts[event.network] = (counts[event.network] ?? 0) + 1;
			}
			return counts;
		},

		async listShares(params) {
			const where: Record<string, unknown> = {};
			if (params?.targetType) where.targetType = params.targetType;
			if (params?.targetId) where.targetId = params.targetId;
			if (params?.network) where.network = params.network;

			const all = await data.findMany("shareEvent", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as ShareEvent[];
		},

		async getTopShared(params) {
			const where: Record<string, unknown> = {};
			if (params?.targetType) where.targetType = params.targetType;

			const all = await data.findMany("shareEvent", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			});
			const events = all as unknown as ShareEvent[];

			// Aggregate counts by targetType+targetId
			const countsMap = new Map<
				string,
				{ targetType: string; targetId: string; count: number }
			>();
			for (const event of events) {
				const key = `${event.targetType}:${event.targetId}`;
				const existing = countsMap.get(key);
				if (existing) {
					existing.count++;
				} else {
					countsMap.set(key, {
						targetType: event.targetType,
						targetId: event.targetId,
						count: 1,
					});
				}
			}

			const sorted = [...countsMap.values()].sort((a, b) => b.count - a.count);
			const take = params?.take ?? 10;
			return sorted.slice(0, take);
		},

		async getSettings() {
			const raw = await data.get("shareSettings", SETTINGS_ID);
			if (!raw) return null;
			return raw as unknown as ShareSettings;
		},

		async updateSettings(params) {
			const existing = await data.get("shareSettings", SETTINGS_ID);
			const current = existing as unknown as ShareSettings | null;
			const now = new Date();

			const updated: ShareSettings = {
				id: SETTINGS_ID,
				enabledNetworks:
					params.enabledNetworks ?? current?.enabledNetworks ?? [],
				defaultMessage: params.defaultMessage ?? current?.defaultMessage,
				hashtags: params.hashtags ?? current?.hashtags ?? [],
				customTemplates:
					params.customTemplates ?? current?.customTemplates ?? {},
				updatedAt: now,
			};
			await data.upsert(
				"shareSettings",
				SETTINGS_ID,
				updated as Record<string, unknown>,
			);
			void events?.emit("share.settings.updated", {
				enabledNetworks: updated.enabledNetworks,
			});
			return updated;
		},

		generateShareUrl(network, targetUrl, message, hashtags) {
			const encoded = encodeURIComponent(targetUrl);
			const text = message ? encodeURIComponent(message) : "";
			const tags = hashtags?.length
				? encodeURIComponent(hashtags.join(","))
				: "";

			switch (network) {
				case "twitter": {
					let url = `https://twitter.com/intent/tweet?url=${encoded}`;
					if (text) url += `&text=${text}`;
					if (tags) url += `&hashtags=${tags}`;
					return url;
				}
				case "facebook":
					return `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
				case "pinterest": {
					let url = `https://pinterest.com/pin/create/button/?url=${encoded}`;
					if (text) url += `&description=${text}`;
					return url;
				}
				case "linkedin":
					return `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`;
				case "whatsapp": {
					const waText = message
						? `${encodeURIComponent(message)} ${encoded}`
						: encoded;
					return `https://api.whatsapp.com/send?text=${waText}`;
				}
				case "email": {
					const subject = message
						? encodeURIComponent(message)
						: encodeURIComponent("Check this out");
					return `mailto:?subject=${subject}&body=${encoded}`;
				}
				case "copy-link":
					return targetUrl;
			}
		},
	};
}
