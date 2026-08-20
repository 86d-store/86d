"use client";

import type { MDXComponents } from "mdx/types";
import { MySubscriptions } from "./my-subscriptions";
import { PlanCard } from "./plan-card";
import { SubscriptionCard } from "./subscription-card";
import { SubscriptionPlans } from "./subscription-plans";

export default {
	SubscriptionPlans,
	MySubscriptions,
	PlanCard,
	SubscriptionCard,
} satisfies MDXComponents;
