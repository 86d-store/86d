"use client";

import { useCallback, useState } from "react";
import { useSubscriptionsApi } from "./_hooks";
import { extractError } from "./_utils";
import { PlanCard } from "./plan-card";
import SubscriptionPlansTemplate from "./subscription-plans.mdx";

interface SubscriptionPlan {
	id: string;
	name: string;
	description?: string | undefined;
	price: number;
	currency: string;
	interval: "day" | "week" | "month" | "year";
	intervalCount: number;
	trialDays?: number | undefined;
	isActive: boolean;
}

interface Subscription {
	id: string;
	planId: string;
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

export function SubscriptionPlans({
	title = "Subscription Plans",
	onSubscribed,
}: {
	title?: string | undefined;
	onSubscribed?: ((sub: Subscription) => void) | undefined;
}) {
	const api = useSubscriptionsApi();
	const [error, setError] = useState("");
	const [success, setSuccess] = useState<Subscription | null>(null);

	const { data: plansData, isLoading } = api.listPlans.useQuery() as {
		data: { plans: SubscriptionPlan[] } | undefined;
		isLoading: boolean;
	};

	const subscribeMutation = api.subscribe.useMutation({
		onSuccess: (data: { subscription: Subscription }) => {
			setSuccess(data.subscription);
			onSubscribed?.(data.subscription);
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to subscribe. Please try again."));
		},
	});

	const handleSubscribe = useCallback(
		(planId: string) => {
			setError("");
			subscribeMutation.mutate({ planId });
		},
		[subscribeMutation],
	);

	const plans = (plansData?.plans ?? []).filter((p) => p.isActive);

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-6 h-7 w-48 animate-pulse rounded-lg bg-muted" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3].map((n) => (
						<div
							key={n}
							className="h-48 animate-pulse rounded-xl border border-border bg-muted"
						/>
					))}
				</div>
			</section>
		);
	}

	const successContent = success ? (
		<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
			<p className="font-semibold text-emerald-800 dark:text-emerald-200">
				You&apos;re subscribed!
			</p>
			<p className="mt-1 text-emerald-700 text-sm dark:text-emerald-300">
				{success.status === "trialing"
					? "Your free trial has started."
					: "Your subscription is now active."}
			</p>
		</div>
	) : null;

	return (
		<SubscriptionPlansTemplate
			title={title}
			error={error}
			empty={plans.length === 0}
			successContent={successContent}
			emailInput={null}
		>
			{plans.map((plan) => (
				<PlanCard
					key={plan.id}
					plan={plan}
					onSubscribe={handleSubscribe}
					subscribing={subscribeMutation.isPending}
				/>
			))}
		</SubscriptionPlansTemplate>
	);
}
