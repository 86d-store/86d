"use client";

import { useState } from "react";
import { usePreordersApi } from "./_hooks";
import { extractError, formatCurrency, formatDate } from "./_utils";

interface Campaign {
	id: string;
	productId: string;
	productName: string;
	variantLabel?: string;
	price: number;
	paymentType: "full" | "deposit";
	depositAmount?: number;
	depositPercent?: number;
	maxQuantity?: number;
	currentQuantity: number;
	endDate?: string;
	estimatedShipDate?: string;
	message?: string;
}

export function CampaignDetail({
	params,
}: {
	params?: { id?: string } | undefined;
}) {
	const api = usePreordersApi();
	const id = params?.id ?? "";
	const [quantity, setQuantity] = useState(1);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");

	const { data, isLoading } = api.getCampaign.useQuery({
		params: { id },
	}) as {
		data: { campaign: Campaign | null } | undefined;
		isLoading: boolean;
	};

	const placeMutation = api.placePreorder.useMutation({
		onSettled: () => {
			void api.myPreorders.invalidate();
		},
		onSuccess: () => {
			setSuccess(true);
			setError("");
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to place pre-order."));
		},
	});

	if (isLoading) {
		return (
			<div className="py-6">
				<div className="mb-4 h-4 w-32 animate-pulse rounded bg-muted" />
				<div className="mx-auto max-w-xl animate-pulse space-y-4 rounded-xl border border-border bg-card p-6">
					<div className="h-5 w-1/3 rounded bg-muted" />
					<div className="h-8 w-1/2 rounded bg-muted" />
					<div className="h-4 w-2/3 rounded bg-muted" />
					<div className="h-4 w-1/2 rounded bg-muted" />
					<div className="mt-4 h-10 w-full rounded-lg bg-muted" />
				</div>
			</div>
		);
	}

	const campaign = data?.campaign;

	if (!campaign) {
		return (
			<div className="py-12 text-center">
				<p className="font-medium text-foreground">Campaign not found</p>
				<p className="mt-1 text-muted-foreground text-sm">
					This pre-order campaign may have ended or been removed.
				</p>
				<a
					href="/preorders"
					className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
				>
					Browse pre-orders
				</a>
			</div>
		);
	}

	const remaining =
		campaign.maxQuantity != null
			? Math.max(0, campaign.maxQuantity - campaign.currentQuantity)
			: null;

	const isSoldOut = remaining !== null && remaining === 0;

	const depositLabel =
		campaign.paymentType === "deposit"
			? campaign.depositPercent
				? `${campaign.depositPercent}% deposit`
				: campaign.depositAmount
					? `${formatCurrency(campaign.depositAmount)} deposit`
					: null
			: null;

	const totalPrice =
		campaign.paymentType === "deposit" && campaign.depositPercent
			? Math.round((campaign.price * campaign.depositPercent) / 100) * quantity
			: campaign.paymentType === "deposit" && campaign.depositAmount
				? campaign.depositAmount * quantity
				: campaign.price * quantity;

	const handlePlace = () => {
		if (isSoldOut) return;
		setError("");
		placeMutation.mutate({ campaignId: campaign.id, quantity });
	};

	return (
		<div className="py-6">
			<nav className="mb-4">
				<a
					href="/preorders"
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					← All pre-orders
				</a>
			</nav>

			<div className="mx-auto max-w-xl">
				<div className="rounded-xl border border-border bg-card p-6">
					<p className="text-muted-foreground text-xs">
						{campaign.productName}
						{campaign.variantLabel && ` — ${campaign.variantLabel}`}
					</p>
					<h1 className="mt-1 font-semibold text-2xl text-foreground tracking-tight">
						Pre-Order
					</h1>

					<div className="mt-4 space-y-1.5 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Price</span>
							<span className="font-medium text-foreground">
								{formatCurrency(campaign.price)}
							</span>
						</div>
						{depositLabel && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Due today</span>
								<span className="font-medium text-foreground">
									{depositLabel}
								</span>
							</div>
						)}
						{campaign.estimatedShipDate && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Est. ship date</span>
								<span className="text-foreground">
									{formatDate(campaign.estimatedShipDate)}
								</span>
							</div>
						)}
						{campaign.endDate && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Campaign ends</span>
								<span className="text-foreground">
									{formatDate(campaign.endDate)}
								</span>
							</div>
						)}
						{remaining !== null && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Availability</span>
								<span
									className={
										remaining === 0
											? "font-medium text-destructive"
											: remaining <= 5
												? "font-medium text-amber-600 dark:text-amber-400"
												: "text-foreground"
									}
								>
									{remaining === 0
										? "Sold out"
										: remaining <= 5
											? `Only ${remaining} left`
											: `${remaining} available`}
								</span>
							</div>
						)}
					</div>

					{campaign.message && (
						<p className="mt-4 rounded-lg bg-muted/50 p-3 text-muted-foreground text-sm">
							{campaign.message}
						</p>
					)}

					{success ? (
						<div className="mt-6 rounded-lg bg-constructive/10 p-4 text-center">
							<p className="font-semibold text-constructive text-sm">
								Pre-order placed!
							</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Check your email for confirmation.
							</p>
							<a
								href="/account/preorders"
								className="mt-3 inline-block rounded-lg border border-constructive/30 px-4 py-2 text-constructive text-sm"
							>
								View my pre-orders
							</a>
						</div>
					) : (
						<div className="mt-6 space-y-3">
							{!isSoldOut && (
								<div className="flex items-center gap-3">
									<label
										htmlFor="preorder-qty"
										className="text-muted-foreground text-sm"
									>
										Quantity
									</label>
									<div className="flex items-center gap-1 rounded-lg border border-border">
										<button
											type="button"
											onClick={() => setQuantity((q) => Math.max(1, q - 1))}
											className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted-foreground hover:bg-muted"
											aria-label="Decrease quantity"
										>
											−
										</button>
										<span
											id="preorder-qty"
											className="w-8 text-center text-foreground text-sm tabular-nums"
										>
											{quantity}
										</span>
										<button
											type="button"
											onClick={() =>
												setQuantity((q) =>
													remaining !== null
														? Math.min(remaining, q + 1)
														: q + 1,
												)
											}
											className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-muted"
											aria-label="Increase quantity"
										>
											+
										</button>
									</div>
									<span className="ml-auto font-semibold text-foreground tabular-nums">
										{formatCurrency(totalPrice)}
									</span>
								</div>
							)}
							{error && <p className="text-destructive text-sm">{error}</p>}
							<button
								type="button"
								onClick={handlePlace}
								disabled={isSoldOut || placeMutation.isPending}
								className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isSoldOut
									? "Sold Out"
									: placeMutation.isPending
										? "Placing order…"
										: "Place Pre-Order"}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
