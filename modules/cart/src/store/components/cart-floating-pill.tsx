"use client";

import { observer } from "@86d-app/core/state";
import { cartState } from "../../state";
import CartFloatingPillTemplate from "./cart-floating-pill.mdx";

/** Floating "open cart" pill when sheet is closed and cart has items. */
export const CartFloatingPill = observer(() => {
	const open = cartState.isDrawerOpen;
	const itemCount = cartState.itemCount;

	if (itemCount <= 0 || open) return null;

	return (
		<CartFloatingPillTemplate
			onClick={() => cartState.openDrawer()}
			ariaLabel={`Open cart — ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
			itemCount={itemCount}
		/>
	);
});
