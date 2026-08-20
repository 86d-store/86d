import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

export const storeSearch = createStoreEndpoint(
	"/wishlist/store-search",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(0).max(500).transform(sanitizeText),
			limit: z.coerce.number().int().min(1).max(50).optional(),
		}),
	},
	async () => {
		return {
			results: [
				{
					id: "wishlist",
					label: "Wishlist",
					href: "/account/wishlist",
					group: "Account",
				},
			],
		};
	},
);
