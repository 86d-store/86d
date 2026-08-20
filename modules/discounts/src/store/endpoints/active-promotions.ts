import { createStoreEndpoint } from "@86d-app/core/api";
import type { DiscountController } from "../../service";

export const activePromotions = createStoreEndpoint(
	"/discounts/active",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const { discounts } = await controller.list({
			isActive: true,
			limit: 50,
		});

		const now = new Date();
		const active = discounts.filter((d) => {
			if (d.startsAt && new Date(d.startsAt) > now) return false;
			if (d.endsAt && new Date(d.endsAt) < now) return false;
			if (
				d.maximumUses !== undefined &&
				d.maximumUses !== null &&
				d.usedCount >= d.maximumUses
			)
				return false;
			return true;
		});

		return {
			promotions: active.map((d) => ({
				id: d.id,
				name: d.name,
				description: d.description,
				type: d.type,
				value: d.value,
				minimumAmount: d.minimumAmount,
				endsAt: d.endsAt,
			})),
		};
	},
);
