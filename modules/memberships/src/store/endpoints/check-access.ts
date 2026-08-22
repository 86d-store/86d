import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const checkAccess = createStoreEndpoint(
	"/memberships/check-access",
	{
		method: "GET",
		query: z.object({
			productId: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { hasAccess: false };
		}

		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const hasAccess = await controller.canAccessProduct({
			customerId: session.user.id,
			productId: ctx.query.productId,
		});

		return { hasAccess };
	},
);
