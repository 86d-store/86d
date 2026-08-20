import { customerIdentityResolveCapability } from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import type { ModuleContext } from "@86d-app/core/types/module";
import { createOrderController } from "../../service-impl";

type OrderEndpointController = ReturnType<typeof createOrderController>;

type OrderCustomerContext =
	| {
			ok: true;
			customerId: string;
			controller: OrderEndpointController;
	  }
	| {
			ok: false;
			response: { code: string; error: string; status: number };
	  };

function profileNames(displayName: string): {
	firstName?: string;
	lastName?: string;
} {
	const [firstName, ...remainingNames] = sanitizeText(displayName).split(" ");
	const lastName = remainingNames.join(" ");
	return {
		...(firstName ? { firstName } : {}),
		...(lastName ? { lastName } : {}),
	};
}

export async function resolveOrderCustomerContext(
	context: ModuleContext,
): Promise<OrderCustomerContext> {
	const session = context.session;
	if (!session) {
		return {
			ok: false,
			response: {
				code: "CUSTOMER_AUTHENTICATION_REQUIRED",
				error: "Unauthorized",
				status: 401,
			},
		};
	}

	const resolved = await context.capabilities.invoke(
		customerIdentityResolveCapability,
		{
			identity: {
				provider: "better_auth",
				subject: session.user.id,
				email: session.user.email,
				emailVerified: session.user.emailVerified,
				...profileNames(session.user.name),
			},
			audit: {
				source: "storefront",
				correlationId: session.session.id,
			},
		},
	);
	if (resolved.ok) {
		const controller = createOrderController(context.data);
		await controller.adoptLegacySubjectOrders(
			session.user.id,
			resolved.decision.customerId,
		);
		return {
			ok: true,
			customerId: resolved.decision.customerId,
			controller,
		};
	}

	if (resolved.failure.code === "AUTH_IDENTITY_UNVERIFIED") {
		return {
			ok: false,
			response: {
				code: "CUSTOMER_EMAIL_VERIFICATION_REQUIRED",
				error: "Verify your email before accessing order history.",
				status: 403,
			},
		};
	}

	return {
		ok: false,
		response: {
			code: "STORE_CUSTOMER_CONTINUITY_UNAVAILABLE",
			error: "Store Customer identity is unavailable.",
			status: 503,
		},
	};
}
