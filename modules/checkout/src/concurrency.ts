import { z } from "zod";

export const checkoutRevisionSchema = z
	.number()
	.int()
	.positive()
	.max(Number.MAX_SAFE_INTEGER);

export class CheckoutRevisionConflictError extends Error {
	readonly currentRevision: number;

	constructor(currentRevision: number) {
		super("Checkout session revision does not match.");
		this.name = "CheckoutRevisionConflictError";
		this.currentRevision = currentRevision;
	}
}

export class CheckoutMutationUnavailableError extends Error {
	constructor() {
		super("Checkout session mutation requires owner-local row locking.");
		this.name = "CheckoutMutationUnavailableError";
	}
}

export async function runCheckoutMutation<T>(work: () => Promise<T>): Promise<
	| { ok: true; value: T }
	| {
			ok: false;
			response:
				| {
						code: "CHECKOUT_REVISION_CONFLICT";
						error: string;
						status: 409;
						currentRevision: number;
				  }
				| {
						code: "CHECKOUT_MUTATION_UNAVAILABLE";
						error: string;
						status: 503;
				  };
	  }
> {
	try {
		return { ok: true, value: await work() };
	} catch (error) {
		if (error instanceof CheckoutRevisionConflictError) {
			return {
				ok: false,
				response: {
					code: "CHECKOUT_REVISION_CONFLICT",
					error:
						"This checkout changed after it was loaded. Refresh it before trying again.",
					status: 409,
					currentRevision: error.currentRevision,
				},
			};
		}
		if (error instanceof CheckoutMutationUnavailableError) {
			return {
				ok: false,
				response: {
					code: "CHECKOUT_MUTATION_UNAVAILABLE",
					error: "Checkout updates are temporarily unavailable.",
					status: 503,
				},
			};
		}
		throw error;
	}
}
