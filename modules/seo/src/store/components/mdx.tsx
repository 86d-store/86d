"use client";

import type { MDXComponents } from "mdx/types";
import { SeoHead } from "./seo-head";
import { SitemapPage } from "./sitemap-page";

export default {
	SeoHead,
	Sitemap: SitemapPage,
	SitemapPage,
} satisfies MDXComponents;
