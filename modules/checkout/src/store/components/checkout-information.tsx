"use client";

import { observer } from "@86d-app/core/state";
import { type FormEvent, useState } from "react";
import { checkoutState } from "../../state";
import { useCheckoutApi } from "./_hooks";
import CheckoutInformationTemplate from "./checkout-information.mdx";

/** Step 1: Collect contact email and optional account info. */
export const CheckoutInformation = observer(() => {
	const api = useCheckoutApi();
	const sessionId = checkoutState.sessionId;

	const { data } = api.getSession.useQuery(
		sessionId ? { params: { id: sessionId } } : undefined,
		{ enabled: !!sessionId },
	) as {
		data: { session: { guestEmail?: string; revision: number } } | undefined;
	};

	const [email, setEmail] = useState(data?.session?.guestEmail ?? "");
	const [error, setError] = useState("");

	const updateMutation = api.updateSession.useMutation({
		onSuccess: () => {
			checkoutState.setStep("shipping");
		},
		onError: () => {
			setError("Failed to save contact information. Please try again.");
		},
	});

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		setError("");

		const trimmed = email.trim();
		if (!trimmed) {
			setError("Email is required.");
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
			setError("Please enter a valid email address.");
			return;
		}

		if (!sessionId || !data?.session) {
			setError("No checkout session found.");
			return;
		}

		updateMutation.mutate({
			params: { id: sessionId },
			expectedRevision: data.session.revision,
			guestEmail: trimmed,
		});
	};

	return (
		<CheckoutInformationTemplate
			email={email}
			error={error}
			loading={updateMutation.isPending}
			onEmailChange={setEmail}
			onSubmit={handleSubmit}
		/>
	);
});
