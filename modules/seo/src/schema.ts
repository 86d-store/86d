import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const seoMetaTagShape = z.object({
	id: z.string().register(col, { pk: true }),
	path: z.string(),
	title: z.string().optional(),
	description: z.string().optional(),
	canonicalUrl: z.string().optional(),
	ogTitle: z.string().optional(),
	ogDescription: z.string().optional(),
	ogImage: z.string().optional(),
	ogType: z.string().optional(),
	twitterCard: z.string().optional(),
	twitterTitle: z.string().optional(),
	twitterDescription: z.string().optional(),
	twitterImage: z.string().optional(),
	noIndex: z.string().default("false"),
	noFollow: z.string().default("false"),
	jsonLd: z.record(z.string(), z.unknown()).optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const seoRedirectShape = z.object({
	id: z.string().register(col, { pk: true }),
	fromPath: z.string(),
	toPath: z.string(),
	statusCode: z.string().default("301"),
	active: z.string().default("true"),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for seo. */
export const seoStorage = {
	kind: "relational",
	tables: {
		metaTag: {
			shape: seoMetaTagShape,
		},
		redirect: {
			shape: seoRedirectShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
