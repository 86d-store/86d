import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { announcementsSchema } from "./schema";
import { createAnnouncementsControllers } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type { Announcement, AnnouncementsController } from "./service";

export interface AnnouncementsOptions extends ModuleConfig {
	/**
	 * Maximum number of active announcements shown simultaneously
	 * @default 5
	 */
	maxActiveAnnouncements?: number;
}

/**
 * Announcements module factory function
 * Creates a module for managing site-wide announcement bars,
 * promotional banners, and popup notices with scheduling and analytics
 */
export default function announcements(options?: AnnouncementsOptions): Module {
	return {
		id: "announcements",
		version: "1.0.0",
		schema: announcementsSchema,
		exports: {
			read: ["activeAnnouncements", "announcementTypes", "announcementStats"],
		},
		events: {
			emits: [
				"announcements.created",
				"announcements.updated",
				"announcements.deleted",
				"announcements.clicked",
				"announcements.dismissed",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createAnnouncementsControllers(ctx.data);

			return {
				controllers: { announcements: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/announcements",
					component: "AnnouncementList",
					label: "Announcements",
					icon: "Megaphone",
					group: "Content",
				},
				{
					path: "/admin/announcements/new",
					component: "AnnouncementForm",
				},
				{
					path: "/admin/announcements/:id",
					component: "AnnouncementDetail",
				},
				{
					path: "/admin/announcements/:id/edit",
					component: "AnnouncementForm",
				},
			],
		},
		options,
	};
}
