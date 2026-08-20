"use client";

import type { MDXComponents } from "mdx/types";
import { OrderDetail } from "./order-detail";
import { OrderHistory } from "./order-history";
import { OrderReturns } from "./order-returns";
import { OrderTracker } from "./order-tracker";

export default {
	OrderHistory,
	OrderDetail,
	OrderReturns,
	OrderTracker,
} satisfies MDXComponents;
