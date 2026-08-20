"use client";

import type { MDXComponents } from "mdx/types";
import { BackInStockForm } from "./back-in-stock-form";
import { StockAvailability } from "./stock-availability";
import { StockStatus } from "./stock-status";

export default {
	BackInStockForm,
	StockAvailability,
	StockStatus,
} satisfies MDXComponents;
