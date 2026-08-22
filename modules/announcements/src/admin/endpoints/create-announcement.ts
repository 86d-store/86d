import { createAdminEndpoint } from "@86d-app/core/api";
import { isSafeUrl, sanitizeHtml, sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { AnnouncementsController } from "../../service";

export const createAnnouncement = createAdminEndpoint(
	"/admin/announcements/create",
	{
		method: "POST",
		body: z.object({
			title: z
				.string()
				.min(1)
				.transform(sanitizeText)
				.refine((s) => s.length >= 1, "Title is required"),
			content: z.string().min(1).max(10000).transform(sanitizeHtml),
			type: z.enum(["bar", "banner", "popup"]).optional(),
			position: z.enum(["top", "bottom"]).optional(),
			linkUrl: z.string().max(2000).refine(isSafeUrl, "Invalid URL").optional(),
			linkText: z.string().max(200).transform(sanitizeText).optional(),
			backgroundColor: z.string().optional(),
			textColor: z.string().optional(),
			iconName: z.string().optional(),
			priority: z.number().int().min(0).optional(),
			isDismissible: z.boolean().optional(),
			startsAt: z.coerce.date().optional(),
			endsAt: z.coerce.date().optional(),
			targetAudience: z.enum(["all", "authenticated", "guest"]).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		const announcement = await controller.createAnnouncement(ctx.body);

		return { announcement };
	},
);
