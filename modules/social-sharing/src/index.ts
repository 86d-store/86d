import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { socialSharingSchema } from "./schema";
import { createSocialSharingController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Network,
	ShareEvent,
	ShareSettings,
	SocialSharingController,
	TargetType,
} from "./service";

export interface SocialSharingOptions extends ModuleConfig {
	/** Comma-separated networks to enable (default: all) */
	enabledNetworks?: string;
	/** Comma-separated default hashtags to include in shares */
	defaultHashtags?: string;
}

export default function socialSharing(options?: SocialSharingOptions): Module {
	return {
		id: "social-sharing",
		version: "0.0.1",
		schema: socialSharingSchema,
		exports: {
			read: ["shareEventNetwork", "shareEventTargetType"],
		},
		events: {
			emits: ["share.created", "share.clicked", "share.settings.updated"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createSocialSharingController(ctx.data, ctx.events);
			return { controllers: { "social-sharing": controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/social-sharing",
					component: "SocialSharingAdmin",
					label: "Social Sharing",
					icon: "Share",
					group: "Marketing",
				},
			],
		},
		options,
	};
}
