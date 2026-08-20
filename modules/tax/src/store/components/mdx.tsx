"use client";

import type { MDXComponents } from "mdx/types";
import { TaxBreakdown } from "./tax-breakdown";
import { TaxEstimate } from "./tax-estimate";

export default {
	TaxEstimate,
	TaxBreakdown,
} satisfies MDXComponents;
