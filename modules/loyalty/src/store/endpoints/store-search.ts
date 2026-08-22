import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { LoyaltyController } from "../../service";

export const storeSearch = createStoreEndpoint(
	"/loyalty/store-search",
	{
		method: "GET",
		query: z.object({
			q: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const tiers = await controller.listTiers();
		const rules = await controller.listRules(true);
		return {
			results: [
				...tiers.map((t) => ({
					type: "tier" as const,
					id: t.id,
					title: t.name,
					description: `${t.minPoints} points to reach`,
				})),
				...rules.map((r) => ({
					type: "rule" as const,
					id: r.id,
					title: r.name,
					description: `${r.points} points (${r.type})`,
				})),
			],
		};
	},
);
