"use client";

import type { MDXComponents } from "mdx/types";
import { Countdown } from "./countdown";
import { FlashDealBadge } from "./flash-deal-badge";
import { FlashSaleDetail } from "./flash-sale-detail";
import { FlashSaleListing } from "./flash-sale-listing";
import { FlashSaleProductCard } from "./flash-sale-product-card";
import { FlashSalesHomepageSection } from "./flash-sales-homepage-section";

export default {
	FlashSaleListing,
	FlashSaleDetail,
	FlashSaleProductCard,
	FlashDealBadge,
	Countdown,
	FlashSalesHomepageSection,
} satisfies MDXComponents;
