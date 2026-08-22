"use client";

import { observer } from "mobx-react-lite";
import { cartState } from "../../state";
import { useCartApi } from "./_hooks";
import CartButtonTemplate from "./cart-button.mdx";

interface CartData {
	id: string;
	items: unknown[];
	subtotal: number;
	itemCount: number;
}

export const CartButton = observer(() => {
	const api = useCartApi();
	const { data } = api.getCart.useQuery() as { data: CartData | undefined };
	const count = data?.itemCount ?? 0;

	return (
		<CartButtonTemplate
			onClick={() => cartState.toggleDrawer()}
			ariaLabel={`Cart${count > 0 ? ` (${count} items)` : ""}`}
			count={count}
		/>
	);
});
