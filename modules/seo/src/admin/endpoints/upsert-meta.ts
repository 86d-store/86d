import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SeoController } from "../../service";

export const upsertMetaEndpoint = createAdminEndpoint(
	"/admin/seo/meta/upsert",
	{
		method: "POST",
		body: z.object({
			path: z.string().min(1).max(2000).transform(sanitizeText),
			title: z.string().max(200).transform(sanitizeText).optional(),
			description: z.string().max(500).transform(sanitizeText).optional(),
			canonicalUrl: z.string().url().max(2000).optional(),
			ogTitle: z.string().max(200).transform(sanitizeText).optional(),
			ogDescription: z.string().max(500).transform(sanitizeText).optional(),
			ogImage: z.string().url().max(2000).optional(),
			ogType: z.string().max(50).transform(sanitizeText).optional(),
			twitterCard: z
				.enum(["summary", "summary_large_image", "app", "player"])
				.optional(),
			twitterTitle: z.string().max(200).transform(sanitizeText).optional(),
			twitterDescription: z
				.string()
				.max(500)
				.transform(sanitizeText)
				.optional(),
			twitterImage: z.string().url().max(2000).optional(),
			noIndex: z.boolean().optional(),
			noFollow: z.boolean().optional(),
			jsonLd: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const meta = await controller.upsertMetaTag({
			path: ctx.body.path,
			title: ctx.body.title,
			description: ctx.body.description,
			canonicalUrl: ctx.body.canonicalUrl,
			ogTitle: ctx.body.ogTitle,
			ogDescription: ctx.body.ogDescription,
			ogImage: ctx.body.ogImage,
			ogType: ctx.body.ogType,
			twitterCard: ctx.body.twitterCard,
			twitterTitle: ctx.body.twitterTitle,
			twitterDescription: ctx.body.twitterDescription,
			twitterImage: ctx.body.twitterImage,
			noIndex: ctx.body.noIndex,
			noFollow: ctx.body.noFollow,
			jsonLd: ctx.body.jsonLd,
		});
		return { meta };
	},
);
