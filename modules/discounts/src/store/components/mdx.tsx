"use client";

import type { MDXComponents } from "mdx/types";
import { AutoAppliedSavings } from "./auto-applied-savings";
import { CartDiscounts } from "./cart-discounts";
import { DiscountBanner } from "./discount-banner";
import { DiscountCodeInput } from "./discount-code-input";

export default {
	AutoAppliedSavings,
	CartDiscounts,
	DiscountBanner,
	DiscountCodeInput,
} satisfies MDXComponents;
