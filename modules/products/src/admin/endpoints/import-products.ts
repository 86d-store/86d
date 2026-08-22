import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

export const importProducts = createAdminEndpoint(
	"/admin/products/import",
	{
		method: "POST",
		body: z.object({
			products: z
				.array(
					z.object({
						name: z.string().min(1).max(200).transform(sanitizeText),
						slug: z.string().max(200).optional(),
						price: z.union([z.number(), z.string()]),
						sku: z.string().max(100).optional(),
						barcode: z.string().max(100).optional(),
						description: z
							.string()
							.max(10000)
							.transform(sanitizeText)
							.optional(),
						shortDescription: z
							.string()
							.max(500)
							.transform(sanitizeText)
							.optional(),
						compareAtPrice: z.union([z.number(), z.string()]).optional(),
						costPrice: z.union([z.number(), z.string()]).optional(),
						inventory: z.union([z.number(), z.string()]).optional(),
						status: z.enum(["draft", "active", "archived"]).optional(),
						category: z.string().optional(),
						tags: z.array(z.string()).optional(),
						weight: z.union([z.number(), z.string()]).optional(),
						weightUnit: z.enum(["kg", "lb", "oz", "g"]).optional(),
						featured: z.boolean().optional(),
						trackInventory: z.boolean().optional(),
						allowBackorder: z.boolean().optional(),
					}),
				)
				.min(1)
				.max(500),
		}),
	},
	async () => {
		return {
			code: "PRODUCT_IMPORT_REVIEW_REQUIRED",
			error:
				"Direct Product import is unavailable until the validated draft, Review, and immutable publish pipeline is configured.",
			status: 503,
		};
	},
);
