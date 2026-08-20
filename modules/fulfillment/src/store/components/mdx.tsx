"use client";

import type { MDXComponents } from "mdx/types";
import { FulfillmentSummary } from "./fulfillment-summary";
import { FulfillmentTracker } from "./fulfillment-tracker";
import { TrackingInfo } from "./tracking-info";

export default {
	FulfillmentTracker,
	FulfillmentSummary,
	TrackingInfo,
} satisfies MDXComponents;
