"use client";

import { useState } from "react";
import { type BulkPriceRule, RuleSheet, useBulkPricingApi } from "./_shared";

const SKELETON_IDS = ["a", "b", "c"] as const;

export function BulkPricingList() {
	const api = useBulkPricingApi();
	const [showCreate, setShowCreate] = useState(false);
	const [editRule, setEditRule] = useState<BulkPriceRule | null>(null);

	const { data, isLoading } = api.list.useQuery({}) as {
		data: { rules?: BulkPriceRule[] } | undefined;
		isLoading: boolean;
	};

	const deleteMutation = api.deleteRule.useMutation({
		onSuccess: () => void api.list.invalidate(),
	});

	const rules = data?.rules ?? [];

	return (
		<div>
			{showCreate ? (
				<RuleSheet
					onSaved={() => setShowCreate(false)}
					onCancel={() => setShowCreate(false)}
				/>
			) : null}
			{editRule ? (
				<RuleSheet
					rule={editRule}
					onSaved={() => setEditRule(null)}
					onCancel={() => setEditRule(null)}
				/>
			) : null}

			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Bulk Pricing</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Configure volume-based pricing tiers for products
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Add Rule
				</button>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{SKELETON_IDS.map((id) => (
						<div
							key={`bp-skel-${id}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : rules.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-10 text-center">
					<p className="font-medium text-foreground text-sm">
						No pricing rules yet
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Create a rule to offer volume discounts on products
					</p>
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
					>
						Add Rule
					</button>
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
									Name
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Scope
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Priority
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
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{rules.map((rule) => (
								<tr
									key={rule.id}
									className="transition-colors hover:bg-muted/50"
								>
									<td className="px-4 py-2 font-medium text-foreground">
										<a
											href={`/admin/bulk-pricing/${rule.id}`}
											className="hover:underline"
										>
											{rule.name ?? rule.id.slice(0, 8)}
										</a>
										{rule.description ? (
											<span className="ml-2 font-normal text-muted-foreground text-xs">
												{rule.description}
											</span>
										) : null}
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs capitalize">
										{rule.scope ?? "—"}
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{rule.priority ?? 0}
									</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												rule.active
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
											}`}
										>
											{rule.active ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-2">
										<div className="flex gap-1">
											<button
												type="button"
												onClick={() => setEditRule(rule)}
												className="rounded px-2 py-1 text-xs hover:bg-muted"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => {
													if (
														window.confirm(
															`Delete rule "${rule.name ?? rule.id}"?`,
														)
													) {
														deleteMutation.mutate({
															params: { id: rule.id },
														});
													}
												}}
												disabled={deleteMutation.isPending}
												className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
											>
												Delete
											</button>
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
