"use client";

import Link from "next/link";
import { usePreordersApi } from "./_hooks";
import { formatCurrency, formatDate } from "./_utils";

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

export interface PreordersHomepageSectionProps {
	/** Max number of campaigns to show. Defaults to 3. */
	limit?: number;
}

/**
 * Compact preorder campaigns section for embedding in the store homepage.
 * Returns null when there are no active campaigns — no loading spinner,
 * no empty state — so the homepage layout is unaffected when idle.
 */
export function PreordersHomepageSection({
	limit = 3,
}: PreordersHomepageSectionProps) {
	const api = usePreordersApi();

	const { data, isLoading } = api.listCampaigns.useQuery({ take: "10" }) as {
		data: { campaigns: Campaign[]; total: number } | undefined;
		isLoading: boolean;
	};

	if (isLoading || !data || data.campaigns.length === 0) return null;

	const visible = data.campaigns.slice(0, limit);

	return (
		<section aria-label="Pre-order campaigns">
			{/* Header */}
			<div className="mb-5 flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<h2 className="font-semibold text-foreground text-lg tracking-tight">
						Pre-orders
					</h2>
					<span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground text-xs">
						Reserve yours now
					</span>
				</div>
				{data.total > limit && (
					<Link
						href="/preorders"
						className="text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						View all
						<span aria-hidden="true"> →</span>
					</Link>
				)}
			</div>

			{/* Campaign cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{visible.map((campaign) => {
					const spotsLeft =
						campaign.maxQuantity != null
							? campaign.maxQuantity - campaign.currentQuantity
							: null;
					const isFull = spotsLeft != null && spotsLeft <= 0;

					return (
						<Link
							key={campaign.id}
							href={`/preorders/${campaign.id}`}
							className="group overflow-hidden rounded-xl border border-border bg-background p-5 transition-shadow hover:shadow-md"
						>
							{/* Product info */}
							<div className="mb-3">
								<p className="font-semibold text-foreground text-sm leading-snug group-hover:underline">
									{campaign.productName}
									{campaign.variantLabel && (
										<span className="ml-1 font-normal text-muted-foreground text-xs">
											— {campaign.variantLabel}
										</span>
									)}
								</p>
								{campaign.message && (
									<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
										{campaign.message}
									</p>
								)}
							</div>

							{/* Pricing */}
							<div className="mb-3">
								{campaign.paymentType === "deposit" &&
								campaign.depositAmount != null ? (
									<div>
										<p className="font-semibold text-foreground text-sm">
											{formatCurrency(campaign.depositAmount)} deposit
										</p>
										<p className="text-muted-foreground text-xs">
											{formatCurrency(campaign.price)} total
										</p>
									</div>
								) : (
									<p className="font-semibold text-foreground text-sm">
										{formatCurrency(campaign.price)}
									</p>
								)}
							</div>

							{/* Spots / dates */}
							<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
								{spotsLeft != null && (
									<span
										className={
											isFull
												? "text-muted-foreground line-through"
												: spotsLeft <= 10
													? "font-medium text-amber-600 dark:text-amber-400"
													: ""
										}
									>
										{isFull ? "Sold out" : `${spotsLeft} left`}
									</span>
								)}
								{campaign.endDate && (
									<span>Ends {formatDate(campaign.endDate)}</span>
								)}
								{campaign.estimatedShipDate && (
									<span>Ships {formatDate(campaign.estimatedShipDate)}</span>
								)}
							</div>

							{/* Progress bar (if limited quantity) */}
							{campaign.maxQuantity != null && campaign.maxQuantity > 0 && (
								<div className="mt-3">
									<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-foreground/60 transition-all"
											style={{
												width: `${Math.min(100, (campaign.currentQuantity / campaign.maxQuantity) * 100)}%`,
											}}
										/>
									</div>
									<p className="mt-1 text-muted-foreground text-xs">
										{campaign.currentQuantity} of {campaign.maxQuantity}{" "}
										reserved
									</p>
								</div>
							)}
						</Link>
					);
				})}
			</div>
		</section>
	);
}
