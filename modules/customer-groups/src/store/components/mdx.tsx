"use client";

import type { MDXComponents } from "mdx/types";
import { CustomerGroupMembership } from "./customer-group-membership";
import { CustomerGroupPricing } from "./customer-group-pricing";

export default {
	CustomerGroupMembership,
	CustomerGroupPricing,
} satisfies MDXComponents;
