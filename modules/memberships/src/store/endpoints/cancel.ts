import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MembershipController } from "../../service";

export const cancel = createStoreEndpoint(
	"/memberships/cancel",
	{
		method: "POST",
		body: z.object({
			membershipId: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.memberships as MembershipController;

		// Verify ownership before mutating
		const existing = await controller.getMembership(ctx.body.membershipId);
		if (!existing || existing.customerId !== session.user.id) {
			return { error: "Membership not found", status: 404 };
		}

		const membership = await controller.cancelMembership(ctx.body.membershipId);
		if (!membership) {
			return { error: "Membership not found", status: 404 };
		}

		return { membership };
	},
);
