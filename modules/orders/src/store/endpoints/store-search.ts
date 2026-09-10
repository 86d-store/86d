import { createStoreEndpoint } from "@86d-store/core/api";
import { sanitizeText } from "@86d-store/core/sanitize";
import { z } from "zod";

export const storeSearch = createStoreEndpoint(
	"/orders/store-search",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(0).max(500).transform(sanitizeText),
			limit: z.string().max(10).optional(),
		}),
	},
	async () => {
		return {
			results: [
				{
					id: "orders",
					label: "Orders",
					href: "/account/orders",
					group: "Account",
				},
			],
		};
	},
);
