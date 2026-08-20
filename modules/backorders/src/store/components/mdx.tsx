"use client";

import type { MDXComponents } from "mdx/types";
import { BackorderButton } from "./backorder-button";
import { MyBackorders } from "./my-backorders";

export { BackorderButton, MyBackorders };

export default {
	BackorderButton,
	MyBackorders,
} satisfies MDXComponents;
