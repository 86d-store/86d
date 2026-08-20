"use client";

import { useState } from "react";
import { useInventoryApi } from "./_hooks";

interface BackInStockNotifyProps {
	productId: string;
	variantId?: string | undefined;
	productName: string;
}

export function BackInStockNotify({
	productId,
	variantId,
	productName,
}: BackInStockNotifyProps) {
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
			<div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
				<div className="flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 256 256"
						fill="currentColor"
						className="text-foreground"
						aria-hidden="true"
					>
						<path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z" />
					</svg>
					<p className="font-medium text-foreground text-xs">
						We'll notify you
					</p>
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					We'll send an email to <strong>{email}</strong> when this item is back
					in stock.
				</p>
			</div>
		);
	}

	return (
		<div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
			<p className="font-medium text-foreground text-xs">Out of stock</p>
			<p className="mt-0.5 text-muted-foreground text-xs">
				Get notified when this item is available again.
			</p>
			<form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="your@email.com"
					required
					className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={subscribeMutation.isPending || !email.trim()}
					className="h-9 rounded-md bg-foreground px-3.5 font-medium text-background text-sm transition-opacity hover:opacity-85 disabled:opacity-40"
				>
					{subscribeMutation.isPending ? "..." : "Notify me"}
				</button>
			</form>
			{error && <p className="mt-1.5 text-red-500 text-xs">{error}</p>}
		</div>
	);
}
