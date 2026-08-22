import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

export const storeSearch = createStoreEndpoint(
	"/subscriptions/store-search",
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
					id: "subscriptions",
					label: "Subscriptions",
					href: "/account/subscriptions",
					group: "Account",
				},
			],
		};
	},
);
