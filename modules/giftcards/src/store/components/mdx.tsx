"use client";

import type { MDXComponents } from "mdx/types";
import { GiftCardBalance } from "./gift-card-balance";
import { GiftCardLanding } from "./gift-card-landing";
import { GiftCardRedeem } from "./gift-card-redeem";

export default {
	GiftCardLanding,
	GiftCardBalance,
	GiftCardRedeem,
} satisfies MDXComponents;
