"use client";

import { useCallback, useState } from "react";
import { useSubscriptionsApi } from "./_hooks";
import { extractError } from "./_utils";
import MySubscriptionsTemplate from "./my-subscriptions.mdx";
import { SubscriptionCard } from "./subscription-card";

interface Subscription {
	id: string;
	planId: string;
	planName?: string | undefined;
	email: string;
	status: string;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	trialStart?: string | undefined;
	trialEnd?: string | undefined;
	cancelledAt?: string | undefined;
	cancelAtPeriodEnd: boolean;
	createdAt: string;
}

export function MySubscriptions({
	title = "My Subscriptions",
}: {
	title?: string | undefined;
}) {
	const api = useSubscriptionsApi();
	const [error, setError] = useState("");

	const {
		data: subsData,
		isLoading,
		refetch,
	} = api.getMySubscriptions.useQuery() as {
		data: { subscriptions: Subscription[] } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const cancelMutation = api.cancelSubscription.useMutation({
		onSuccess: () => {
			refetch();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to cancel subscription."));
		},
	});

	const handleCancel = useCallback(
		(id: string, atPeriodEnd: boolean) => {
			cancelMutation.mutate({
				id,
				cancelAtPeriodEnd: atPeriodEnd,
			});
		},
		[cancelMutation],
	);

	const subs = subsData?.subscriptions ?? [];

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-4 h-7 w-40 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-3">
					{[1, 2].map((n) => (
						<div key={n} className="h-24 animate-pulse rounded-xl bg-muted" />
					))}
				</div>
			</section>
		);
	}

	return (
		<MySubscriptionsTemplate
			title={title}
			error={error}
			empty={subs.length === 0}
		>
			{subs.map((sub) => (
				<SubscriptionCard
					key={sub.id}
					subscription={sub}
					cancelling={cancelMutation.isPending}
					onCancel={(atPeriodEnd) => handleCancel(sub.id, atPeriodEnd)}
				/>
			))}
		</MySubscriptionsTemplate>
	);
}
