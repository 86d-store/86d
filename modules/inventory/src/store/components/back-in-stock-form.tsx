"use client";

import { useState } from "react";
import { useInventoryApi } from "./_hooks";

/**
 * Standalone back-in-stock subscription form.
 * Use in MDX templates on any page to let customers subscribe for a specific product.
 *
 * @example
 * ```mdx
 * <BackInStockForm productId="prod_123" productName="Widget Pro" />
 * ```
 */
export function BackInStockForm(props: {
	productId: string;
	variantId?: string;
	productName?: string;
}) {
	const { productId, variantId, productName } = props;
	const [email, setEmail] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const api = useInventoryApi();

	const subscribeMutation = api.subscribeBackInStock.useMutation({
		onSuccess: () => {
			setSubmitted(true);
			setError(null);
		},
		onError: () => {
			setError("Something went wrong. Please try again.");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!email.trim()) return;
		setError(null);
		subscribeMutation.mutate({
			productId,
			variantId,
			email: email.trim(),
			productName,
		});
	};

	if (submitted) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4">
				<p className="font-medium text-foreground text-sm">
					You're on the list!
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					We'll email <strong>{email}</strong> when{" "}
					{productName ?? "this product"} is back in stock.
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-md border border-border bg-muted/30 p-4">
			<p className="font-medium text-foreground text-sm">
				Notify me when available
			</p>
			<p className="mt-1 text-muted-foreground text-sm">
				Enter your email and we'll let you know when{" "}
				{productName ?? "this product"} is restocked.
			</p>
			<form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="your@email.com"
					required
					className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={subscribeMutation.isPending || !email.trim()}
					className="h-10 rounded-md bg-foreground px-4 font-medium text-background text-sm transition-opacity hover:opacity-85 disabled:opacity-40"
				>
					{subscribeMutation.isPending ? "Subscribing..." : "Notify me"}
				</button>
			</form>
			{error && <p className="mt-2 text-red-500 text-xs">{error}</p>}
		</div>
	);
}
