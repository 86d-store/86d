"use client";

import { formatPrice, intervalLabel } from "./_utils";
import PlanCardTemplate from "./plan-card.mdx";

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

export function PlanCard({
	plan,
	onSubscribe,
	subscribing,
}: {
	plan: SubscriptionPlan;
	onSubscribe: (planId: string) => void;
	subscribing: boolean;
}) {
	return (
		<PlanCardTemplate
			plan={plan}
			onSubscribe={onSubscribe}
			subscribing={subscribing}
			formatPrice={formatPrice}
			intervalLabel={intervalLabel}
		/>
	);
}
