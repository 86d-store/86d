"use client";

import type { MDXComponents } from "mdx/types";
import { StoreCreditApply } from "./store-credit-apply";
import { StoreCreditBalance } from "./store-credit-balance";
import { StoreCreditTransactions } from "./store-credit-transactions";

export default {
	StoreCreditBalance,
	StoreCreditTransactions,
	StoreCreditApply,
} satisfies MDXComponents;
