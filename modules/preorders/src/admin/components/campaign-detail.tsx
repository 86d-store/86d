"use client";

import {
	CAMPAIGN_STATUS_COLORS,
	type Campaign,
	formatCurrency,
	formatDate,
	usePreordersApi,
} from "./_shared";

interface PreorderItem {
	id: string;
	campaignId: string;
	customerId: string;
	customerEmail: string;
	quantity: number;
	status: string;
	orderId?: string;
	reason?: string;
	createdAt: string;
	updatedAt: string;
}

const ITEM_STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	ready:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	fulfilled:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	refunded: "bg-muted text-muted-foreground",
};

export function CampaignDetail({ params }: { params: { id: string } }) {
	const api = usePreordersApi();

	const { data, isLoading } = api.getCampaign.useQuery({
		params: { id: params.id },
	}) as {
		data:
			| { campaign?: Campaign; items?: PreorderItem[]; error?: string }
			| undefined;
		isLoading: boolean;
	};

	const readyMutation = api.readyItem.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const fulfillMutation = api.fulfillItem.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const cancelItemMutation = api.cancelItem.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const campaign = data?.campaign;
	const items = data?.items ?? [];

	const handleItemAction = async (
		itemId: string,
		action: "ready" | "fulfill" | "cancel",
	) => {
		try {
			switch (action) {
				case "ready":
					await readyMutation.mutateAsync({ params: { id: itemId } });
					break;
				case "fulfill":
					await fulfillMutation.mutateAsync({
						params: { id: itemId },
						body: {},
					});
					break;
				case "cancel":
					await cancelItemMutation.mutateAsync({
						params: { id: itemId },
						body: {},
					});
					break;
			}
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
				<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
			</div>
		);
	}

	if (!campaign) {
		return (
			<div className="rounded-lg border border-border bg-card p-8 text-center">
				<p className="text-muted-foreground text-sm">Campaign not found.</p>
				<a
					href="/admin/preorders"
					className="mt-2 inline-block text-sm underline"
				>
					Back to preorders
				</a>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/preorders"
					className="text-muted-foreground text-sm hover:underline"
				>
					&larr; Back to preorders
				</a>
				<div className="mt-2 flex items-center gap-3">
					<h1 className="font-bold text-foreground text-xl">
						{campaign.productName}
					</h1>
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${CAMPAIGN_STATUS_COLORS[campaign.status] ?? "bg-muted text-muted-foreground"}`}
					>
						{campaign.status}
					</span>
				</div>
			</div>

			{/* Campaign details */}
			<div className="mb-6 grid gap-6 lg:grid-cols-2">
				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Campaign Details
					</h2>
					<dl className="space-y-3 text-sm">
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Price</dt>
							<dd className="font-medium text-foreground">
								{formatCurrency(campaign.price)}
							</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Payment</dt>
							<dd className="text-foreground">
								{campaign.paymentType === "deposit" ? "Deposit" : "Full"}
							</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Start</dt>
							<dd className="text-foreground">
								{formatDate(campaign.startDate)}
							</dd>
						</div>
						{campaign.endDate ? (
							<div className="flex justify-between">
								<dt className="text-muted-foreground">End</dt>
								<dd className="text-foreground">
									{formatDate(campaign.endDate)}
								</dd>
							</div>
						) : null}
						{campaign.estimatedShipDate ? (
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Est. Ship</dt>
								<dd className="text-foreground">
									{formatDate(campaign.estimatedShipDate)}
								</dd>
							</div>
						) : null}
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Total Ordered</dt>
							<dd className="font-medium text-foreground">
								{campaign.totalOrdered}
							</dd>
						</div>
					</dl>
				</div>
			</div>

			{/* Items */}
			<h2 className="mb-4 font-semibold text-foreground text-lg">
				Preorder Items ({items.length})
			</h2>
			{items.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No preorder items yet.
					</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-border border-b bg-muted">
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Customer
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Qty
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Date
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{items.map((item) => (
								<tr
									key={item.id}
									className="transition-colors hover:bg-muted/50"
								>
									<td className="px-4 py-2 font-mono text-foreground text-xs">
										{item.customerEmail}
									</td>
									<td className="px-4 py-2 text-foreground">{item.quantity}</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${ITEM_STATUS_COLORS[item.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{item.status}
										</span>
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{formatDate(item.createdAt)}
									</td>
									<td className="px-4 py-2">
										<div className="flex gap-1">
											{item.status === "pending" ||
											item.status === "confirmed" ? (
												<button
													type="button"
													onClick={() => handleItemAction(item.id, "ready")}
													className="rounded px-2 py-1 text-xs hover:bg-muted"
												>
													Ready
												</button>
											) : null}
											{item.status === "ready" ? (
												<button
													type="button"
													onClick={() => handleItemAction(item.id, "fulfill")}
													className="rounded px-2 py-1 text-green-700 text-xs hover:bg-green-50 dark:hover:bg-green-900/20"
												>
													Fulfill
												</button>
											) : null}
											{item.status !== "fulfilled" &&
											item.status !== "cancelled" &&
											item.status !== "refunded" ? (
												<button
													type="button"
													onClick={() => handleItemAction(item.id, "cancel")}
													className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
												>
													Cancel
												</button>
											) : null}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
