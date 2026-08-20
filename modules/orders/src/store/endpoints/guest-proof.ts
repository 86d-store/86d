export const GUEST_PROOF_METADATA_KEY = "guestProofDigest";

export async function digestGuestProof(proof: string): Promise<string> {
	const hashed = new Uint8Array(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(proof)),
	);
	return [...hashed].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function guestProofMatches(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return difference === 0;
}

export async function orderAcceptsGuestProof(
	order: { metadata?: Record<string, unknown> | undefined },
	proofs: readonly string[],
): Promise<boolean> {
	const expected = order.metadata?.[GUEST_PROOF_METADATA_KEY];
	if (typeof expected !== "string" || proofs.length === 0) return false;
	for (const proof of proofs) {
		if (guestProofMatches(await digestGuestProof(proof), expected)) {
			return true;
		}
	}
	return false;
}
