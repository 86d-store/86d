"use client";

import type { MDXComponents } from "mdx/types";
import { ShippingEstimator } from "./shipping-estimator";
import { ShippingOptions } from "./shipping-options";
import { ShippingRateSummary } from "./shipping-rate-summary";

export default {
	ShippingEstimator,
	ShippingOptions,
	ShippingRateSummary,
} satisfies MDXComponents;
