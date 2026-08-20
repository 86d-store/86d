import { sanitizeText } from "@86d-app/core/sanitize";
import type { ModuleContext } from "@86d-app/core/types/module";
import {
	createStoreCustomerIdentityService,
	type StoreCustomer,
} from "../../identity-binding";
import { createCustomerController } from "../../service-impl";

type CustomerEndpointController = ReturnType<typeof createCustomerController>;

type CustomerEndpointResolution =
	| {
			ok: true;
			customer: StoreCustomer;
			controller: CustomerEndpointController;
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

/** Resolve the trusted Better Auth session to a Store-owned Customer. */
export async function resolveAuthenticatedStoreCustomer(
	context: ModuleContext,
): Promise<CustomerEndpointResolution> {
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

	const result = await createStoreCustomerIdentityService(
		context.transactions,
	).resolveOrCreate({
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
	});
	if (result.ok) {
		return {
			ok: true,
			customer: result.customer,
			controller: createCustomerController(context.data, context.events),
		};
	}
	if (result.code === "AUTH_IDENTITY_UNVERIFIED") {
		return {
			ok: false,
			response: {
				code: "CUSTOMER_EMAIL_VERIFICATION_REQUIRED",
				error: "Verify your email before accessing your customer profile.",
				status: 403,
			},
		};
	}
	if (result.code === "AUTH_IDENTITY_CONFLICT") {
		return {
			ok: false,
			response: {
				code: "CUSTOMER_IDENTITY_CONFLICT",
				error: "The authenticated identity cannot be resolved safely.",
				status: 409,
			},
		};
	}
	return {
		ok: false,
		response: {
			code: "CUSTOMER_IDENTITY_UNAVAILABLE",
			error: "The customer identity service is unavailable.",
			status: 503,
		},
	};
}
