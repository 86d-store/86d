import { customerIdentityResolveCapability } from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import type { ModuleContext } from "@86d-app/core/types/module";

export type StoreCustomerResolution =
	| { ok: true; customerId?: undefined }
	| { ok: true; customerId: string }
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

/**
 * Map a verified authentication principal to a Store Customer ID.
 * Guests resolve to no customer. Auth identity is never persisted as customerId.
 */
export async function resolveStoreCustomer(
	context: Pick<ModuleContext, "session" | "capabilities">,
): Promise<StoreCustomerResolution> {
	const session = context.session;
	if (!session) {
		return { ok: true };
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
		return { ok: true, customerId: resolved.decision.customerId };
	}
	if (resolved.failure.code === "AUTH_IDENTITY_UNVERIFIED") {
		return {
			ok: false,
			response: {
				code: "CUSTOMER_EMAIL_VERIFICATION_REQUIRED",
				error: "Verify your email before continuing checkout.",
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
