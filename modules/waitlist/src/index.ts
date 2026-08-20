import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { waitlistStorage } from "./schema";
import { createWaitlistController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	WaitlistController,
	WaitlistEntry,
	WaitlistStatus,
	WaitlistSummary,
} from "./service";

export interface WaitlistOptions extends ModuleConfig {
	/** Maximum entries per email address */
	maxEntriesPerEmail?: string;
}

export default function waitlist(options?: WaitlistOptions): Module {
	return {
		id: "waitlist",
		version: "0.0.1",
		storage: waitlistStorage,
		requires: ["inventory"],
		exports: {
			read: ["waitlistCount", "isOnWaitlist"],
		},
		events: {
			emits: [
				"waitlist.subscribed",
				"waitlist.unsubscribed",
				"waitlist.notified",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createWaitlistController(ctx.data);
			return { controllers: { waitlist: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/waitlist",
					component: "WaitlistDashboard",
					label: "Waitlist",
					icon: "Bell",
					group: "Marketing",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/waitlist",
					component: "WaitlistPage",
				},
			],
		},
		options,
	};
}
