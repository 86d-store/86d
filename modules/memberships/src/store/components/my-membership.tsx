"use client";

import { useState } from "react";
import { useMembershipsApi } from "./_hooks";
import {
	formatIntervalFull,
	formatPrice,
	getBenefitIcon,
	getBenefitLabel,
	getStatusColor,
} from "./_utils";
import MyMembershipTemplate from "./my-membership.mdx";

interface MembershipPlan {
	id: string;
	name: string;
	slug: string;
	price: number;
	billingInterval: string;
}

interface MembershipData {
	id: string;
	status: string;
	startDate: string;
	endDate?: string;
	trialEndDate?: string;
	plan: MembershipPlan;
}

interface BenefitData {
	id: string;
	type: string;
	value: string;
	description?: string;
}

export function MyMembership() {
	const api = useMembershipsApi();
	const [cancelling, setCancelling] = useState(false);
	const [cancelled, setCancelled] = useState(false);

	const { data, isLoading } = api.getMyMembership.useQuery() as {
		data:
			| { membership: MembershipData | null; benefits: BenefitData[] }
			| undefined;
		isLoading: boolean;
	};

	const cancelMutation = api.cancel.useMutation();

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div>
					<div className="h-7 w-40 animate-pulse rounded bg-muted" />
					<div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted-foreground/10" />
				</div>
				<div className="animate-pulse rounded-xl border border-border p-6">
					<div className="h-5 w-24 rounded bg-muted" />
					<div className="mt-3 h-4 w-48 rounded bg-muted-foreground/10" />
				</div>
			</div>
		);
	}

	const membership = data?.membership;
	const benefits = data?.benefits ?? [];

	if (!membership) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="font-bold text-2xl text-foreground tracking-tight">
						My Membership
					</h1>
				</div>
				<div className="rounded-xl border border-border bg-background p-8 text-center">
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
						className="mx-auto mb-3 text-muted-foreground/50"
						aria-hidden="true"
					>
						<path d="M6 3h12l4 6-10 13L2 9z" />
					</svg>
					<p className="font-medium text-foreground text-sm">
						You don&apos;t have an active membership
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Browse our plans and unlock exclusive benefits.
					</p>
					<a
						href="/memberships"
						className="mt-4 inline-flex items-center rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm transition-opacity hover:opacity-90"
					>
						View plans
					</a>
				</div>
			</div>
		);
	}

	const statusColor = getStatusColor(membership.status);
	const isActive =
		membership.status === "active" || membership.status === "trial";

	const handleCancel = async () => {
		setCancelling(true);
		try {
			await cancelMutation.mutateAsync({
				membershipId: membership.id,
			});
			setCancelled(true);
		} catch {
			// ignore
		} finally {
			setCancelling(false);
		}
	};

	const statusCard = (
		<div className="rounded-xl border border-border bg-background p-6">
			<div className="flex items-start justify-between">
				<div>
					<h2 className="font-semibold text-foreground text-lg">
						{membership.plan.name}
					</h2>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{formatPrice(membership.plan.price)}{" "}
						{formatIntervalFull(membership.plan.billingInterval)}
					</p>
				</div>
				<span
					className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs capitalize ring-1 ring-inset ${statusColor.bg} ${statusColor.text} ${statusColor.ring}`}
				>
					{cancelled ? "cancelled" : membership.status}
				</span>
			</div>
			<div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<span className="text-muted-foreground text-xs">Member since</span>
					<p className="text-foreground">
						{new Date(membership.startDate).toLocaleDateString()}
					</p>
				</div>
				{membership.trialEndDate && membership.status === "trial" && (
					<div>
						<span className="text-muted-foreground text-xs">Trial ends</span>
						<p className="text-foreground">
							{new Date(membership.trialEndDate).toLocaleDateString()}
						</p>
					</div>
				)}
				{membership.endDate && (
					<div>
						<span className="text-muted-foreground text-xs">
							{membership.status === "cancelled" ? "Ends" : "Renews"}
						</span>
						<p className="text-foreground">
							{new Date(membership.endDate).toLocaleDateString()}
						</p>
					</div>
				)}
			</div>
		</div>
	);

	const benefitsCard =
		benefits.length > 0 ? (
			<div className="rounded-xl border border-border bg-background p-6">
				<h2 className="mb-3 font-semibold text-foreground">Your Benefits</h2>
				<div className="space-y-2.5">
					{benefits.map((b) => (
						<div key={b.id} className="flex items-start gap-3">
							<span className="text-base" aria-hidden="true">
								{getBenefitIcon(b.type)}
							</span>
							<div>
								<p className="font-medium text-foreground text-sm">
									{getBenefitLabel(b.type)}
									{b.type === "discount_percentage" && ` — ${b.value}% off`}
								</p>
								{b.description && (
									<p className="text-muted-foreground text-xs">
										{b.description}
									</p>
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		) : null;

	const actions =
		isActive && !cancelled ? (
			<div className="flex gap-3">
				<a
					href="/memberships"
					className="rounded-md border border-border px-4 py-2 text-foreground text-sm transition-colors hover:bg-muted"
				>
					Change plan
				</a>
				<button
					type="button"
					onClick={handleCancel}
					disabled={cancelling}
					className="rounded-md border border-red-200 px-4 py-2 text-red-600 text-sm transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
				>
					{cancelling ? "Cancelling..." : "Cancel membership"}
				</button>
			</div>
		) : null;

	return (
		<MyMembershipTemplate
			statusCard={statusCard}
			benefitsCard={benefitsCard}
			actions={actions}
		/>
	);
}
