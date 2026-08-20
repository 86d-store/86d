"use client";

import { useAbandonedCartApi } from "./_hooks";
import { formatCurrency } from "./_utils";
import CartRecoveryTemplate from "./cart-recovery.mdx";

interface CartItemSnapshot {
	productId: string;
	variantId?: string;
	name: string;
	price: number;
	quantity: number;
	imageUrl?: string;
}

interface AbandonedCart {
	id: string;
	cartId: string;
	email?: string;
	items: CartItemSnapshot[];
	cartTotal: number;
	currency: string;
	status: string;
	recoveryToken: string;
}

export function CartRecovery({ token }: { token: string }) {
	const api = useAbandonedCartApi();
	const { data, isLoading } = api.recover.useQuery({
		params: { token },
	}) as {
		data: { cart: AbandonedCart } | { error: string } | undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return (
			<div className="space-y-4 py-4">
				{Array.from({ length: 2 }).map((_, i) => (
					<div
						key={`skel-${i}`}
						className="flex items-center gap-4 rounded-lg border border-border p-4"
					>
						<div className="h-16 w-16 flex-shrink-0 animate-pulse rounded-md bg-muted" />
						<div className="flex-1 space-y-2">
							<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
							<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (!data || "error" in data) {
		return (
			<CartRecoveryTemplate
				expired
				items={[]}
				cartTotal=""
				formatCurrency={formatCurrency}
			/>
		);
	}

	const { cart } = data;

	return (
		<CartRecoveryTemplate
			expired={false}
			items={cart.items}
			cartTotal={formatCurrency(cart.cartTotal, cart.currency)}
			cartId={cart.cartId}
			formatCurrency={formatCurrency}
		/>
	);
}
