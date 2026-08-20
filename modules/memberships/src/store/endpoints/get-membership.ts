import { createStoreEndpoint } from "@86d-app/core/api";
import type { MembershipController } from "../../service";

export const getMembership = createStoreEndpoint(
	"/memberships/my-membership",
	{
		method: "GET",
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const customerId = session.user.id;
		const membership = await controller.getCustomerMembership(customerId);
		if (!membership) {
			return { membership: null, benefits: [] };
		}

		const benefits = await controller.getCustomerBenefits(customerId);

		return { membership, benefits };
	},
);
