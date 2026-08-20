"use client";

import { useState } from "react";
import { usePreordersApi } from "./_hooks";

interface Campaign {
	id: string;
	name: string;
	releaseDate?: string | null;
	maxQuantity?: number | null;
	remainingQuantity?: number | null;
	depositAmount?: number | null;
	currency: string;
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

/**
 * Shows a preorder option when a product has an active preorder campaign.
 * Appears alongside or instead of the back-in-stock notify when the product is sold out.
 * Returns null when the preorders module is not installed or no campaign is active.
 */
export function PreorderSection({
	productId,
	variantId,
}: {
	productId: string;
	variantId?: string | undefined;
}) {
	const api = usePreordersApi();
	const [qty] = useState(1);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");

	const checkResult = api.checkAvailability.useQuery(
		{
			params: { productId },
			...(variantId ? { variantId } : {}),
		},
		{ enabled: !!productId },
	) as {
		data:
			| {
					available: boolean;
					campaign: Campaign | null;
					remainingQuantity: number | null;
			  }
			| undefined;
		isError: boolean;
	};

	const placeMutation = api.placePreorder.useMutation({
		onSuccess: () => {
			setSuccess(true);
		},
		onError: () => {
			setError("Failed to place preorder. Please try again.");
		},
	});

	if (checkResult.isError || !checkResult.data?.available) return null;

	const campaign = checkResult.data.campaign;
	if (!campaign) return null;

	if (success) {
		return (
			<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
				<p className="font-medium text-emerald-700 text-sm dark:text-emerald-400">
					Preorder placed!
				</p>
				<p className="mt-0.5 text-emerald-600 text-xs dark:text-emerald-500">
					We&apos;ll notify you when your order is ready.
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-md border border-border p-3">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div>
					<p className="font-medium text-foreground text-sm">
						Available for Preorder
					</p>
					{campaign.releaseDate && (
						<p className="mt-0.5 text-muted-foreground text-xs">
							Expected: {formatDate(campaign.releaseDate)}
						</p>
					)}
					{campaign.remainingQuantity != null &&
						campaign.remainingQuantity <= 20 && (
							<p className="mt-0.5 text-amber-600 text-xs dark:text-amber-400">
								Only {campaign.remainingQuantity} spots left
							</p>
						)}
					{campaign.depositAmount != null && campaign.depositAmount > 0 && (
						<p className="mt-0.5 text-muted-foreground text-xs">
							Deposit: {formatPrice(campaign.depositAmount, campaign.currency)}
						</p>
					)}
				</div>
				<span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 font-medium text-foreground text-xs">
					Preorder
				</span>
			</div>

			<button
				type="button"
				onClick={() =>
					placeMutation.mutate({ campaignId: campaign.id, quantity: qty })
				}
				disabled={placeMutation.isPending}
				className="w-full rounded-md bg-foreground py-2.5 font-medium text-background text-sm transition-opacity hover:opacity-85 disabled:opacity-50"
			>
				{placeMutation.isPending ? "Placing preorder..." : "Preorder now"}
			</button>

			{error && (
				<p className="mt-1.5 text-destructive text-xs" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
