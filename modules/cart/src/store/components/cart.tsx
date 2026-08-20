"use client";

import { observer } from "@86d-app/core/state";
import { cartState } from "../../state";
import CartTemplate from "./cart.mdx";
import { CartDrawerInner } from "./cart-drawer-inner";
import { CartFloatingPill } from "./cart-floating-pill";

/** Cart: renders cart.mdx (Sheet from store registry) with inner content and floating pill. */
export const Cart = observer(() => (
	<CartTemplate
		open={cartState.isDrawerOpen}
		onOpenChange={(open: boolean) => {
			if (!open) cartState.closeDrawer();
		}}
		sheetContent={<CartDrawerInner />}
		floatingPill={<CartFloatingPill />}
	/>
));
