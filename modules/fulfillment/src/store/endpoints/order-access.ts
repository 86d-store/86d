import {
	customerIdentityResolveCapability,
	orderCustomerAuthorizeCapability,
	orderGuestProofAuthorizeCapability,
} from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import type { ModuleContext } from "@86d-app/core/types/module";

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

function collectGuestProofs(cookieHeader: string | null): string[] {
	if (!cookieHeader) return [];
	const proofs: string[] = [];
	for (const part of cookieHeader.split(";")) {
		const [name, ...rest] = part.trim().split("=");
		if (
			name?.startsWith("checkout_guest_") ||
			name?.startsWith("order_guest_")
		) {
			const value = rest.join("=");
			if (value.length >= 16) proofs.push(value);
		}
	}
	return proofs.slice(0, 8);
}

export async function canAccessOrderFulfillment(
	context: Pick<ModuleContext, "session" | "capabilities">,
	orderId: string,
	cookieHeader: string | null,
): Promise<boolean> {
	const session = context.session;
	if (session) {
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
		if (!resolved.ok) return false;
		const authorized = await context.capabilities.invoke(
			orderCustomerAuthorizeCapability,
			{
				orderId,
				customerId: resolved.decision.customerId,
			},
		);
		return authorized.ok;
	}

	const proofs = collectGuestProofs(cookieHeader);
	if (proofs.length === 0) return false;
	const authorized = await context.capabilities.invoke(
		orderGuestProofAuthorizeCapability,
		{ orderId, proofs },
	);
	return authorized.ok;
}
