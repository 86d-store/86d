import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { socialProofStorage } from "./schema";
import { createSocialProofController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ActivityEvent,
	ActivityEventType,
	ActivityPeriod,
	ActivitySummary,
	BadgePosition,
	ProductActivity,
	SocialProofController,
	TrendingProduct,
	TrustBadge,
} from "./service";

export interface SocialProofOptions extends ModuleConfig {
	/** Maximum activity events to retain per product. Default: 10000. */
	maxEventsPerProduct?: string;
	/** Default time period for activity queries. Default: "24h". */
	defaultPeriod?: string;
}

export default function socialProof(options?: SocialProofOptions): Module {
	return {
		id: "social-proof",
		version: "0.0.1",
		storage: socialProofStorage,
		exports: {
			read: [
				"productActivity",
				"trendingProducts",
				"recentActivity",
				"trustBadges",
			],
		},
		events: {
			emits: [
				"activity.recorded",
				"badge.created",
				"badge.updated",
				"badge.deleted",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createSocialProofController(ctx.data);
			return { controllers: { socialProof: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/social-proof",
					component: "SocialProofAdmin",
					label: "Social Proof",
					icon: "TrendingUp",
					group: "Marketing",
				},
			],
		},
		options,
	};
}
