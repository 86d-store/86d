"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { HeartIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { buttonVariants } from "~/components/ui/button-variants";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

interface WishlistItem {
	id: string;
	customerId: string;
	productId: string;
	productName: string;
	productImage?: string | undefined;
	createdAt: string;
}

interface Customer {
	id: string;
	email: string;
	firstName?: string | undefined;
	lastName?: string | undefined;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

// ── Wishlist Page ───────────────────────────────────────────────────────────

export default function WishlistPage() {
	const client = useModuleClient();

	const customerApi = client.module("customers").store["/customers/me"];
	const { data: customerData } = customerApi.useQuery() as {
		data: { customer: Customer } | undefined;
	};

	const customerId = customerData?.customer?.id;

	const wishlistApi = client.module("wishlist").store["/wishlist"];
	const removeApi = client.module("wishlist").store["/wishlist/remove/:id"];

	const {
		data: wishlistData,
		isLoading,
		isError,
		refetch,
	} = wishlistApi.useQuery(customerId ? { customerId } : undefined, {
		enabled: !!customerId,
	}) as {
		data: { items: WishlistItem[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const items = wishlistData?.items ?? [];
	const [removeError, setRemoveError] = useState("");

	async function handleRemove(id: string) {
		setRemoveError("");
		try {
			await removeApi.fetch({ params: { id } });
			wishlistApi.invalidate();
		} catch {
			setRemoveError("Failed to remove item. Please try again.");
		}
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="font-bold font-display text-foreground text-xl tracking-tight sm:text-2xl">
					Wishlist
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Items you&apos;ve saved for later.
				</p>
			</div>

			{removeError && (
				<p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm">
					{removeError}
				</p>
			)}

			{isError ? (
				<div
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					<p>Failed to load your wishlist.</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-1 font-medium underline"
					>
						Try again
					</button>
				</div>
			) : isLoading || !customerId ? (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{[1, 2, 3].map((n) => (
						<Skeleton key={n} className="h-48 rounded-xl" />
					))}
				</div>
			) : items.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HeartIcon />
						</EmptyMedia>
						<EmptyTitle>Your wishlist is empty</EmptyTitle>
						<EmptyDescription>
							Save items you love while browsing the store.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<a href="/products" className={buttonVariants()}>
							Browse products
						</a>
					</EmptyContent>
				</Empty>
			) : (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{items.map((item) => (
						<div
							key={item.id}
							className="group overflow-hidden rounded-xl border border-border"
						>
							{/* Product image */}
							<a href={`/products/${item.productId}`} className="block">
								{item.productImage ? (
									<Image
										src={item.productImage}
										alt={item.productName}
										width={400}
										height={400}
										unoptimized
										className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
									/>
								) : (
									<div className="flex aspect-square w-full items-center justify-center bg-muted">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="32"
											height="32"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="1"
											strokeLinecap="round"
											strokeLinejoin="round"
											className="text-muted-foreground/40"
											aria-hidden="true"
										>
											<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
											<circle cx="9" cy="9" r="2" />
											<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
										</svg>
									</div>
								)}
							</a>

							{/* Item info */}
							<div className="p-3">
								<a
									href={`/products/${item.productId}`}
									className="line-clamp-2 font-medium text-foreground text-sm hover:underline"
								>
									{item.productName}
								</a>
								<p className="mt-0.5 text-muted-foreground text-xs">
									Saved {formatDate(item.createdAt)}
								</p>
								<button
									type="button"
									onClick={() => handleRemove(item.id)}
									className="mt-2 text-muted-foreground text-xs transition-colors hover:text-destructive"
								>
									Remove
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
