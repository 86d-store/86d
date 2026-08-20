"use client";

import { useState } from "react";
import { useMembershipsApi } from "./_hooks";
import {
	formatInterval,
	formatIntervalFull,
	formatPrice,
	getBenefitIcon,
	getBenefitLabel,
} from "./_utils";
import PlanDetailTemplate from "./plan-detail.mdx";

interface BenefitData {
	id: string;
	type: string;
	value: string;
	description?: string;
}

interface PlanData {
	id: string;
	name: string;
	slug: string;
	description?: string;
	price: number;
	billingInterval: string;
	trialDays: number;
	features?: string[];
}

export function PlanDetail(props: {
	slug?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const slug = props.slug ?? props.params?.slug;
	const api = useMembershipsApi();
	const [subscribing, setSubscribing] = useState(false);
	const [subscribeResult, setSubscribeResult] = useState<
		"success" | "error" | null
	>(null);

	const { data, isLoading } = api.getPlan.useQuery(
		{ slug: slug ?? "" },
		{ enabled: Boolean(slug) },
	) as {
		data: { plan: PlanData; benefits: BenefitData[] } | undefined;
		isLoading: boolean;
	};

	const subscribeMutation = api.subscribe.useMutation();

	if (!slug) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted-foreground text-sm">Plan not found</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="mx-auto max-w-2xl animate-pulse space-y-6">
				<div className="h-4 w-32 rounded bg-muted-foreground/10" />
				<div className="h-8 w-48 rounded bg-muted" />
				<div className="h-4 w-72 rounded bg-muted-foreground/10" />
				<div className="h-12 w-32 rounded bg-muted" />
				<div className="space-y-3 rounded-xl border border-border p-6">
					<div className="h-5 w-24 rounded bg-muted" />
					<div className="h-4 w-full rounded bg-muted-foreground/10" />
					<div className="h-4 w-3/4 rounded bg-muted-foreground/10" />
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="py-16 text-center">
				<p className="font-medium text-foreground text-sm">Plan not found</p>
				<a
					href="/memberships"
					className="mt-2 inline-block text-muted-foreground text-sm underline"
				>
					Browse all plans
				</a>
			</div>
		);
	}

	const { plan, benefits } = data;

	const handleSubscribe = async () => {
		setSubscribing(true);
		setSubscribeResult(null);
		try {
			await subscribeMutation.mutateAsync({
				planId: plan.id,
			});
			setSubscribeResult("success");
		} catch {
			setSubscribeResult("error");
		} finally {
			setSubscribing(false);
		}
	};

	const header = (
		<div>
			<h1 className="font-bold text-2xl text-foreground tracking-tight">
				{plan.name}
			</h1>
			{plan.description && (
				<p className="mt-2 text-muted-foreground">{plan.description}</p>
			)}
			<div className="mt-4 flex items-baseline gap-1.5">
				<span className="font-bold text-4xl text-foreground">
					{formatPrice(plan.price)}
				</span>
				<span className="text-muted-foreground">
					{formatIntervalFull(plan.billingInterval)}
				</span>
			</div>
			{plan.trialDays > 0 && (
				<p className="mt-1 text-green-600 text-sm dark:text-green-400">
					Start with a {plan.trialDays}-day free trial
				</p>
			)}
		</div>
	);

	const benefitsSection =
		benefits.length > 0 ? (
			<div className="rounded-xl border border-border bg-background p-6">
				<h2 className="mb-4 font-semibold text-foreground text-lg">
					Member Benefits
				</h2>
				<div className="space-y-3">
					{benefits.map((benefit) => (
						<div key={benefit.id} className="flex items-start gap-3">
							<span className="mt-0.5 text-lg" aria-hidden="true">
								{getBenefitIcon(benefit.type)}
							</span>
							<div>
								<p className="font-medium text-foreground text-sm">
									{getBenefitLabel(benefit.type)}
									{benefit.type === "discount_percentage" &&
										` — ${benefit.value}% off`}
								</p>
								{benefit.description && (
									<p className="text-muted-foreground text-xs">
										{benefit.description}
									</p>
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		) : null;

	const featuresSection =
		plan.features && plan.features.length > 0 ? (
			<div className="rounded-xl border border-border bg-background p-6">
				<h2 className="mb-4 font-semibold text-foreground text-lg">
					What&apos;s Included
				</h2>
				<ul className="space-y-2.5">
					{plan.features.map((feature) => (
						<li
							key={feature}
							className="flex items-start gap-2.5 text-muted-foreground text-sm"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="mt-0.5 shrink-0 text-green-600 dark:text-green-400"
								aria-hidden="true"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
							{feature}
						</li>
					))}
				</ul>
			</div>
		) : null;

	const actionSection = (
		<div className="space-y-3">
			{subscribeResult === "success" ? (
				<div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950/30">
					<p className="font-medium text-green-800 text-sm dark:text-green-300">
						Welcome! Your membership is now active.
					</p>
					<a
						href="/account"
						className="mt-1 inline-block text-green-600 text-xs underline dark:text-green-400"
					>
						Go to your account
					</a>
				</div>
			) : (
				<>
					<button
						type="button"
						onClick={handleSubscribe}
						disabled={subscribing}
						className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{subscribing
							? "Subscribing..."
							: plan.trialDays > 0
								? `Start ${plan.trialDays}-day free trial`
								: `Subscribe — ${formatPrice(plan.price)}${formatInterval(plan.billingInterval)}`}
					</button>
					{subscribeResult === "error" && (
						<p className="text-center text-red-500 text-sm">
							Could not subscribe. Please sign in and try again.
						</p>
					)}
				</>
			)}
		</div>
	);

	return (
		<PlanDetailTemplate
			planName={plan.name}
			header={header}
			benefitsSection={benefitsSection}
			featuresSection={featuresSection}
			actionSection={actionSection}
		/>
	);
}
