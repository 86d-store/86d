"use client";

import type { MDXComponents } from "mdx/types";
import { MyMembership } from "./my-membership";
import { PlanDetail } from "./plan-detail";
import { PlanListing } from "./plan-listing";

export default {
	PlanListing,
	PlanDetail,
	MyMembership,
} satisfies MDXComponents;
