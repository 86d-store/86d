"use client";

import type { MDXComponents } from "mdx/types";
import { MyQuotes } from "./my-quotes";
import { QuoteDetail } from "./quote-detail";
import { QuoteRequest } from "./quote-request";
export default {
	MyQuotes,
	QuoteDetail,
	QuoteRequest,
} satisfies MDXComponents;
