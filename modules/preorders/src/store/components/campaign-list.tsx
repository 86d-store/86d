"use client";

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

export function CampaignList() {
	const api = usePreordersApi();

	const { data, isLoading: loading } = api.listCampaigns.useQuery({
		take: "50",
	}) as {
		data: { campaigns: Campaign[]; total: number } | undefined;
		isLoading: boolean;
	};

	const campaigns = data?.campaigns ?? [];

	if (loading) {
		return (
			<div className="py-6">
				<div className="mb-6">
					<div className="h-7 w-40 animate-pulse rounded bg-muted" />
					<div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{["pre-a", "pre-b", "pre-c", "pre-d", "pre-e", "pre-f"].map((k) => (
						<div
							key={k}
							className="animate-pulse overflow-hidden rounded-xl border border-border bg-card"
						>
							<div className="space-y-3 p-5">
								<div className="h-4 w-1/2 rounded bg-muted" />
								<div className="h-6 w-3/4 rounded bg-muted" />
								<div className="h-4 w-1/3 rounded bg-muted" />
								<div className="mt-4 h-9 w-full rounded-lg bg-muted" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (campaigns.length === 0) {
		return (
			<div className="py-6">
				<div className="mb-6">
					<h1 className="font-semibold text-2xl text-foreground tracking-tight">
						Pre-Orders
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Reserve upcoming products before they launch.
					</p>
				</div>
				<div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 py-20 text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="mb-3 text-muted-foreground/40"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="10" />
						<polyline points="12 6 12 12 16 14" />
					</svg>
					<p className="font-medium text-foreground text-sm">
						No active pre-orders
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Check back soon for upcoming product launches.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="py-6">
			<div className="mb-6">
				<h1 className="font-semibold text-2xl text-foreground tracking-tight">
					Pre-Orders
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Reserve upcoming products before they launch.
				</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{campaigns.map((campaign) => {
					const depositLabel =
						campaign.paymentType === "deposit"
							? campaign.depositPercent
								? `${campaign.depositPercent}% deposit`
								: campaign.depositAmount
									? `${formatCurrency(campaign.depositAmount)} deposit`
									: null
							: null;

					const remaining =
						campaign.maxQuantity != null
							? Math.max(0, campaign.maxQuantity - campaign.currentQuantity)
							: null;

					return (
						<a
							key={campaign.id}
							href={`/preorders/${campaign.id}`}
							className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
						>
							<div className="flex flex-1 flex-col gap-2 p-5">
								<p className="text-muted-foreground text-xs">
									{campaign.productName}
									{campaign.variantLabel && ` — ${campaign.variantLabel}`}
								</p>
								<p className="font-semibold text-foreground group-hover:text-primary">
									Pre-order now
								</p>
								<p className="font-bold text-foreground text-xl tabular-nums">
									{formatCurrency(campaign.price)}
								</p>
								{depositLabel && (
									<p className="text-muted-foreground text-xs">
										{depositLabel} due now
									</p>
								)}
								{campaign.estimatedShipDate && (
									<p className="text-muted-foreground text-xs">
										Est. ships{" "}
										<span className="text-foreground">
											{formatDate(campaign.estimatedShipDate)}
										</span>
									</p>
								)}
								{remaining !== null && remaining <= 10 && remaining > 0 && (
									<p className="font-medium text-amber-600 text-xs dark:text-amber-400">
										Only {remaining} left
									</p>
								)}
								{remaining === 0 && (
									<p className="font-medium text-destructive text-xs">
										Sold out
									</p>
								)}
								{campaign.endDate && (
									<p className="text-muted-foreground text-xs">
										Ends {formatDate(campaign.endDate)}
									</p>
								)}
								<div className="mt-3 rounded-lg bg-primary px-4 py-2 text-center font-medium text-primary-foreground text-sm transition-opacity group-hover:opacity-90">
									Pre-order
								</div>
							</div>
						</a>
					);
				})}
			</div>
		</div>
	);
}
