import type { ModuleContext } from "@86d-app/core/types/module";
import type { CheckoutRequest } from "../../checkout-request";

const COOKIE_PREFIX = "checkout_request_guest_";

type CheckoutRequestAccessContext = {
	context: Pick<ModuleContext, "session">;
	getCookie: (key: string) => string | null;
	setCookie: (
		key: string,
		value: string,
		options?: Record<string, unknown>,
	) => string;
};

function cookieName(requestId: string): string {
	return `${COOKIE_PREFIX}${requestId}`;
}

function matches(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return difference === 0;
}

export async function checkoutRequestProofDigest(
	proof: string,
): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(proof),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

/** Derive a retry-stable, purpose-bound proof from the high-entropy guest ID. */
export async function deriveCheckoutRequestProof(
	guestId: string,
	operationKey: string,
): Promise<string> {
	return checkoutRequestProofDigest(
		`checkout-request-access:v1:${guestId}:${operationKey}`,
	);
}

export function setCheckoutRequestProofCookie(
	context: CheckoutRequestAccessContext,
	request: CheckoutRequest,
	proof: string,
): void {
	const maxAge = Math.max(
		1,
		Math.floor((request.expiresAt.getTime() - Date.now()) / 1000),
	);
	context.setCookie(cookieName(request.id), proof, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/api/checkout/requests",
		maxAge,
	});
}

export async function canAccessCheckoutRequest(
	context: CheckoutRequestAccessContext,
	request: CheckoutRequest,
): Promise<boolean> {
	if (request.owner.type === "authenticated_shopper") {
		return request.owner.id === context.context.session?.user.id;
	}
	if (!request.accessProofDigest) return false;
	const proof = context.getCookie(cookieName(request.id));
	if (!proof) return false;
	return matches(
		await checkoutRequestProofDigest(proof),
		request.accessProofDigest,
	);
}

/** Never expose the guest proof digest to an endpoint response. */
export function publicCheckoutRequest(request: CheckoutRequest) {
	const {
		accessProofDigest: _accessProofDigest,
		auditActor: _auditActor,
		owner: _owner,
		requestDigest: _requestDigest,
		requestDigestVersion: _requestDigestVersion,
		...safeRequest
	} = request;
	return safeRequest;
}
