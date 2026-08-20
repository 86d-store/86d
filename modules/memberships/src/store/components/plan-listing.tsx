"use client";

import Link from "next/link";
import { useMembershipsApi } from "./_hooks";
import { formatInterval, formatPrice } from "./_utils";
import PlanListingTemplate from "./plan-listing.mdx";

interface PlanData {
	id: string;
	name: string;
	slug: string;
	description?: string;
	price: number;
	billingInterval: string;
	trialDays: number;
	features?: string[];
	sortOrder: number;
}

const PLAN_SKELETON_IDS = ["a", "b", "c"] as const;

export function PlanListing() {
	const api = useMembershipsApi();

	const { data, isLoading } = api.listPlans.useQuery() as {
		data: { plans: PlanData[] } | undefined;
		isLoading: boolean;
	};

	const plans = data?.plans ?? [];

	if (isLoading) {
		return (
			<div className="space-y-8">
				<div className="text-center">
					<div className="mx-auto h-8 w-48 animate-pulse rounded bg-muted" />
					<div className="mx-auto mt-3 h-4 w-72 animate-pulse rounded bg-muted-foreground/10" />
				</div>
				<div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{PLAN_SKELETON_IDS.map((id) => (
						<div
							key={`plan-skel-${id}`}
							className="animate-pulse rounded-xl border border-border p-6"
						>
							<div className="mb-4 h-5 w-24 rounded bg-muted" />
							<div className="mb-2 h-8 w-20 rounded bg-muted" />
							<div className="mb-6 h-3 w-16 rounded bg-muted-foreground/10" />
							<div className="space-y-2">
								<div className="h-3 w-full rounded bg-muted-foreground/10" />
								<div className="h-3 w-3/4 rounded bg-muted-foreground/10" />
								<div className="h-3 w-5/6 rounded bg-muted-foreground/10" />
							</div>
							<div className="mt-6 h-10 w-full rounded bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (plans.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="32"
					height="32"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="mb-3 text-muted-foreground/50"
					aria-hidden="true"
				>
					<path d="M6 3h12l4 6-10 13L2 9z" />
				</svg>
				<p className="font-medium text-foreground text-sm">
					No membership plans available
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check back soon for exclusive membership offers
				</p>
			</div>
		);
	}

	const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

	const planCards = sorted.map((plan) => (
		<Link
			key={plan.id}
			href={`/memberships/${plan.slug}`}
			className="group flex flex-col rounded-xl border border-border bg-background p-6 transition-shadow hover:shadow-md"
		>
			<h3 className="font-semibold text-foreground text-lg transition-colors group-hover:text-foreground/80">
				{plan.name}
			</h3>
			{plan.description && (
				<p className="mt-1 text-muted-foreground text-sm">{plan.description}</p>
			)}

			<div className="mt-4 flex items-baseline gap-1">
				<span className="font-bold text-3xl text-foreground">
					{formatPrice(plan.price)}
				</span>
				<span className="text-muted-foreground text-sm">
					{formatInterval(plan.billingInterval)}
				</span>
			</div>

			{plan.trialDays > 0 && (
				<p className="mt-1 text-muted-foreground text-xs">
					{plan.trialDays}-day free trial
				</p>
			)}

			{plan.features && plan.features.length > 0 && (
				<ul className="mt-4 flex-1 space-y-2">
					{plan.features.map((feature) => (
						<li
							key={feature}
							className="flex items-start gap-2 text-muted-foreground text-sm"
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
			)}

			<div className="mt-6 flex items-center justify-center rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors group-hover:bg-muted">
				View plan
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="ml-1.5"
					aria-hidden="true"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
			</div>
		</Link>
	));

	return <PlanListingTemplate planCards={planCards} />;
}
