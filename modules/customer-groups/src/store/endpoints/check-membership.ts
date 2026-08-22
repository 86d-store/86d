import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerGroupController } from "../../service";

export const checkMembership = createStoreEndpoint(
	"/customer-groups/check",
	{
		method: "GET",
		query: z.object({
			groupSlug: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;
		const customerId = ctx.context.session?.user?.id;

		if (!customerId) {
			return { isMember: false };
		}

		const group = await controller.getGroupBySlug(ctx.query.groupSlug);
		if (!group) {
			return { isMember: false };
		}

		const isMember = await controller.isMember(group.id, customerId);

		return {
			isMember,
			group: { id: group.id, name: group.name, slug: group.slug },
		};
	},
);
