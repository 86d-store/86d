"use client";

import { observer } from "@86d-app/core/state";
import { checkoutState } from "../../state";
import CheckoutFormTemplate from "./checkout-form.mdx";
import { CheckoutInformation } from "./checkout-information";
import { CheckoutPayment } from "./checkout-payment";
import { CheckoutReview } from "./checkout-review";
import { CheckoutShipping } from "./checkout-shipping";
import { CheckoutSummary } from "./checkout-summary";

const STEPS = ["information", "shipping", "payment", "review"] as const;
const STEP_LABELS = {
	information: "Contact",
	shipping: "Shipping",
	payment: "Payment",
	review: "Review",
} as const;

/** Multi-step checkout form. Renders the active step + order summary sidebar. */
export const CheckoutForm = observer(() => {
	const currentStep = checkoutState.currentStep;
	const sessionId = checkoutState.sessionId;

	if (!sessionId) {
		return (
			<CheckoutFormTemplate
				hasSession={false}
				steps={[]}
				currentStepIndex={0}
				stepContent={null}
				summaryContent={null}
			/>
		);
	}

	const currentIndex = STEPS.indexOf(currentStep);

	const steps = STEPS.map((step, i) => ({
		id: step,
		label: STEP_LABELS[step],
		active: step === currentStep,
		completed: i < currentIndex,
	}));

	let stepContent: React.ReactNode;
	switch (currentStep) {
		case "information":
			stepContent = <CheckoutInformation />;
			break;
		case "shipping":
			stepContent = <CheckoutShipping />;
			break;
		case "payment":
			stepContent = <CheckoutPayment />;
			break;
		case "review":
			stepContent = <CheckoutReview />;
			break;
	}

	return (
		<CheckoutFormTemplate
			hasSession
			steps={steps}
			currentStepIndex={currentIndex}
			stepContent={stepContent}
			summaryContent={<CheckoutSummary />}
		/>
	);
});
