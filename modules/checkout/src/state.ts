import { makeAutoObservable } from "@86d-app/core/state";

export type CheckoutStep = "information" | "shipping" | "payment" | "review";

/**
 * Checkout UI state — shared across components via MobX.
 * Tracks which step the user is on and stores transient form data
 * that doesn't need to persist to the server on every keystroke.
 */
export const checkoutState = makeAutoObservable({
	currentStep: "information" as CheckoutStep,
	sessionId: null as string | null,
	isProcessing: false,
	sameAsShipping: true,

	setStep(step: CheckoutStep) {
		this.currentStep = step;
	},

	setSessionId(id: string | null) {
		this.sessionId = id;
	},

	setProcessing(v: boolean) {
		this.isProcessing = v;
	},

	setSameAsShipping(v: boolean) {
		this.sameAsShipping = v;
	},

	reset() {
		this.currentStep = "information";
		this.sessionId = null;
		this.isProcessing = false;
		this.sameAsShipping = true;
	},
});

export type CheckoutState = typeof checkoutState;
