"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import DiscountAnalyticsTemplate from "./discount-analytics.mdx";

interface DiscountSummaryData {
	id: string;
	name: string;
	type: "percentage" | "fixed_amount" | "free_shipping";
	value: number;
	usedCount: number;
	maximumUses?: number | undefined;
	isActive: boolean;
	codesCount: number;
}

interface DiscountAnalyticsData {
	totalDiscounts: number;
	activeCount: number;
	expiredCount: number;
	scheduledCount: number;
	totalUsage: number;
	totalCodes: number;
	typeDistribution: Record<string, number>;
	topByUsage: DiscountSummaryData[];
}

function useDiscountsAdminApi() {
	const client = useModuleClient();
	return {
		analytics: client.module("discounts").admin["/admin/discounts/analytics"],
	};
}

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-xl border border-border bg-card p-5">
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
				{label}
			</p>
			<p className="mt-1 font-semibold text-2xl text-foreground">{value}</p>
		</div>
	);
}

function TypeBadge({ type }: { type: string }) {
	const styles: Record<string, string> = {
		percentage: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
		fixed_amount:
			"bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
		free_shipping:
			"bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
	};
	const labels: Record<string, string> = {
		percentage: "Percentage",
		fixed_amount: "Fixed",
		free_shipping: "Free Ship",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${styles[type] ?? ""}`}
		>
			{labels[type] ?? type}
		</span>
	);
}

function formatValue(type: string, value: number): string {
	if (type === "percentage") return `${value}%`;
	if (type === "fixed_amount") {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(value / 100);
	}
	return "—";
}

function TypeDistributionBar({
	label,
	count,
	total,
	color,
}: {
	label: string;
	count: number;
	total: number;
	color: string;
}) {
	const pct = total > 0 ? Math.round((count / total) * 100) : 0;
	return (
		<div className="flex items-center gap-3">
			<span className="w-24 text-muted-foreground text-sm">{label}</span>
			<div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
				<div
					className={`h-full rounded-full transition-all ${color}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="w-10 text-right text-muted-foreground text-xs">
				{count}
			</span>
		</div>
	);
}

export function DiscountAnalytics() {
	const api = useDiscountsAdminApi();

	const {
		data,
		isLoading: loading,
		isError: analyticsError,
		refetch: refetchAnalytics,
	} = api.analytics.useQuery({}) as {
		data: { analytics: DiscountAnalyticsData } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (analyticsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load discount analytics
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchAnalytics()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-muted-foreground text-sm">Loading analytics...</p>
			</div>
		);
	}

	const analytics = data?.analytics;

	if (!analytics) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-muted-foreground text-sm">
					No analytics data available.
				</p>
			</div>
		);
	}

	const content = (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-foreground text-lg">
					Discount Analytics
				</h2>
				<p className="text-muted-foreground text-sm">
					Performance overview of your discount campaigns
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard label="Total Discounts" value={analytics.totalDiscounts} />
				<StatCard label="Active" value={analytics.activeCount} />
				<StatCard label="Total Uses" value={analytics.totalUsage} />
				<StatCard label="Promo Codes" value={analytics.totalCodes} />
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded-xl border border-border bg-card p-5">
					<h3 className="mb-4 font-medium text-foreground text-sm">
						Type Distribution
					</h3>
					<div className="space-y-3">
						<TypeDistributionBar
							label="Percentage"
							count={analytics.typeDistribution.percentage}
							total={analytics.totalDiscounts}
							color="bg-blue-500"
						/>
						<TypeDistributionBar
							label="Fixed Amount"
							count={analytics.typeDistribution.fixed_amount}
							total={analytics.totalDiscounts}
							color="bg-emerald-500"
						/>
						<TypeDistributionBar
							label="Free Shipping"
							count={analytics.typeDistribution.free_shipping}
							total={analytics.totalDiscounts}
							color="bg-purple-500"
						/>
					</div>
				</div>

				<div className="rounded-xl border border-border bg-card p-5">
					<h3 className="mb-4 font-medium text-foreground text-sm">
						Status Breakdown
					</h3>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
								<span className="text-foreground text-sm">Active</span>
							</div>
							<span className="font-medium text-foreground text-sm">
								{analytics.activeCount}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
								<span className="text-foreground text-sm">Scheduled</span>
							</div>
							<span className="font-medium text-foreground text-sm">
								{analytics.scheduledCount}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="h-2.5 w-2.5 rounded-full bg-muted" />
								<span className="text-foreground text-sm">
									Expired / Inactive
								</span>
							</div>
							<span className="font-medium text-foreground text-sm">
								{analytics.expiredCount}
							</span>
						</div>
					</div>
				</div>
			</div>

			{analytics.topByUsage.length > 0 && (
				<div className="rounded-xl border border-border bg-card p-5">
					<h3 className="mb-4 font-medium text-foreground text-sm">
						Top Discounts by Usage
					</h3>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-border border-b text-left">
									<th
										scope="col"
										className="pr-4 pb-3 font-medium text-muted-foreground"
									>
										Name
									</th>
									<th
										scope="col"
										className="pr-4 pb-3 font-medium text-muted-foreground"
									>
										Type
									</th>
									<th
										scope="col"
										className="pr-4 pb-3 font-medium text-muted-foreground"
									>
										Value
									</th>
									<th
										scope="col"
										className="pr-4 pb-3 text-right font-medium text-muted-foreground"
									>
										Uses
									</th>
									<th
										scope="col"
										className="pr-4 pb-3 text-right font-medium text-muted-foreground"
									>
										Limit
									</th>
									<th
										scope="col"
										className="pb-3 text-right font-medium text-muted-foreground"
									>
										Codes
									</th>
								</tr>
							</thead>
							<tbody>
								{analytics.topByUsage.map((d) => (
									<tr
										key={d.id}
										className="border-border border-b last:border-b-0"
									>
										<td className="py-3 pr-4">
											<div className="flex items-center gap-2">
												<span
													className={`h-1.5 w-1.5 rounded-full ${d.isActive ? "bg-emerald-500" : "bg-muted"}`}
												/>
												<span className="font-medium text-foreground">
													{d.name}
												</span>
											</div>
										</td>
										<td className="py-3 pr-4">
											<TypeBadge type={d.type} />
										</td>
										<td className="py-3 pr-4 text-foreground">
											{formatValue(d.type, d.value)}
										</td>
										<td className="py-3 pr-4 text-right font-medium text-foreground">
											{d.usedCount}
										</td>
										<td className="py-3 pr-4 text-right text-muted-foreground">
											{d.maximumUses != null ? d.maximumUses : "—"}
										</td>
										<td className="py-3 text-right text-muted-foreground">
											{d.codesCount}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);

	return <DiscountAnalyticsTemplate content={content} />;
}
