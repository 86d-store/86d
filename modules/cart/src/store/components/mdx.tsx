"use client";

import type { MDXComponents } from "mdx/types";
import { Cart } from "./cart";
import { CartButton } from "./cart-button";
import { CartDrawerInner } from "./cart-drawer-inner";
import { CartFloatingPill } from "./cart-floating-pill";
import { CartPage } from "./cart-page";

export default {
	Cart,
	CartButton,
	CartDrawerInner,
	CartFloatingPill,
	CartPage,
} satisfies MDXComponents;
