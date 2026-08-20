"use client";

import { useState } from "react";
import { useWaitlistApi } from "./_hooks";
import { extractError } from "./_utils";
import { BellIcon } from "./bell-icon";
import WaitlistButtonTemplate from "./waitlist-button.mdx";

export function WaitlistButton({
	productId,
	productName,
	variantId,
	variantLabel,
	email,
	customerId,
}: {
	productId: string;
	productName: string;
	variantId?: string | undefined;
	variantLabel?: string | undefined;
	email?: string | undefined;
	customerId?: string | undefined;
}) {
	const api = useWaitlistApi();
	const [error, setError] = useState("");
	const [emailInput, setEmailInput] = useState(email ?? "");
	const [showForm, setShowForm] = useState(false);

	const { data: checkData, isLoading: checking } = email
		? (api.checkWaitlist.useQuery({
				params: { productId },
				email,
			}) as {
				data: { subscribed: boolean; waitingCount: number } | undefined;
				isLoading: boolean;
			})
		: { data: undefined, isLoading: false };

	const subscribed = checkData?.subscribed ?? false;
	const waitingCount = checkData?.waitingCount ?? 0;

	const joinMutation = api.joinWaitlist.useMutation({
		onSettled: () => {
			void api.checkWaitlist.invalidate();
			void api.myWaitlist.invalidate();
			setShowForm(false);
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to join waitlist."));
		},
	});

	const leaveMutation = api.leaveWaitlist.useMutation({
		onSettled: () => {
			void api.checkWaitlist.invalidate();
			void api.myWaitlist.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to leave waitlist."));
		},
	});

	const handleJoin = () => {
		const targetEmail = email ?? emailInput;
		if (!targetEmail) {
			setShowForm(true);
			return;
		}
		setError("");
		joinMutation.mutate({
			productId,
			productName,
			variantId,
			variantLabel,
			email: targetEmail,
			customerId,
		});
	};

	const handleLeave = () => {
		const targetEmail = email ?? emailInput;
		if (!targetEmail) return;
		setError("");
		leaveMutation.mutate({ email: targetEmail, productId });
	};

	return (
		<WaitlistButtonTemplate
			subscribed={subscribed}
			checking={checking}
			waitingCount={waitingCount}
			showForm={showForm}
			emailInput={emailInput}
			onEmailChange={setEmailInput}
			onJoin={handleJoin}
			onLeave={handleLeave}
			isPending={joinMutation.isPending || leaveMutation.isPending}
			bellIcon={<BellIcon active={subscribed} />}
			error={error}
			hasEmail={!!email}
		/>
	);
}
