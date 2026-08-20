"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ComparisonAdminTemplate from "./comparison-admin.mdx";

interface ComparisonItemData {
	id: string;
	customerId?: string;
	sessionId?: string;
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string;
	productPrice?: number;
	productCategory?: string;
	attributes?: Record<string, string>;
	addedAt: string;
}

interface FrequentProduct {
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string;
	compareCount: number;
}

const PAGE_SIZE = 30;

function formatDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function useComparisonAdminApi() {
	const client = useModuleClient();
	return {
		listAll: client.module("comparisons").admin["/admin/comparisons"],
		frequent: client.module("comparisons").admin["/admin/comparisons/frequent"],
		deleteItem:
			client.module("comparisons").admin["/admin/comparisons/:id/delete"],
	};
}

export function ComparisonAdmin() {
	const api = useComparisonAdminApi();
	const [skip, setSkip] = useState(0);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data: frequentData, isLoading: frequentLoading } =
		api.frequent.useQuery({ take: "10" }) as {
			data: { products: FrequentProduct[] } | undefined;
			isLoading: boolean;
		};

	const { data: listData, isLoading: listLoading } = api.listAll.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
	}) as {
		data: { items: ComparisonItemData[]; total: number } | undefined;
		isLoading: boolean;
	};

	const frequent = frequentData?.products ?? [];
	const items = listData?.items ?? [];
	const total = listData?.total ?? 0;

	const deleteMutation = api.deleteItem.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.listAll.invalidate();
			void api.frequent.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete item."));
		},
	});

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const loading = frequentLoading || listLoading;

	const itemsContent = loading ? (
		<div className="animate-pulse px-5 py-3">
			<div className="mb-3 h-8 w-full rounded bg-muted" />
			{Array.from({ length: 5 }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-4 border-border border-t py-3"
				>
					<div className="h-4 w-40 rounded bg-muted" />
					<div className="h-4 w-24 rounded bg-muted" />
					<div className="h-4 w-16 rounded bg-muted" />
					<div className="ml-auto h-4 w-28 rounded bg-muted" />
				</div>
			))}
		</div>
	) : items.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No comparison items recorded yet.
		</div>
	) : (
		<>
			<div className="hidden md:block">
				<table className="w-full text-left text-sm">
					<thead className="border-border border-b bg-muted/50">
						<tr>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Product
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Customer
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Price
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Added
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{items.map((item) => (
							<tr key={item.id}>
								<td className="px-5 py-3">
									<span className="text-foreground">{item.productName}</span>
								</td>
								<td className="px-5 py-3 font-mono text-muted-foreground text-xs">
									{item.customerId
										? "Registered customer"
										: item.sessionId
											? `session:${item.sessionId.slice(0, 6)}`
											: "anonymous"}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{item.productPrice != null
										? formatPrice(item.productPrice)
										: "—"}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{formatDate(item.addedAt)}
								</td>
								<td className="px-5 py-3">
									{deleteConfirm === item.id ? (
										<span className="space-x-2">
											<button
												type="button"
												onClick={() => handleDelete(item.id)}
												className="font-medium text-destructive text-xs hover:opacity-80"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setDeleteConfirm(null)}
												className="text-muted-foreground text-xs hover:text-foreground"
											>
												Cancel
											</button>
										</span>
									) : (
										<button
											type="button"
											onClick={() => setDeleteConfirm(item.id)}
											className="text-muted-foreground text-xs hover:text-destructive"
										>
											Delete
										</button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="divide-y divide-border md:hidden">
				{items.map((item) => (
					<div key={item.id} className="px-5 py-3">
						<div className="flex items-start justify-between">
							<div>
								<p className="font-medium text-foreground text-sm">
									{item.productName}
								</p>
								<p className="mt-0.5 font-mono text-muted-foreground text-xs">
									{item.customerId
										? `Customer: ${item.customerId.slice(0, 8)}...`
										: item.sessionId
											? `Session: ${item.sessionId.slice(0, 6)}`
											: "Anonymous"}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{formatDate(item.addedAt)}
								</p>
							</div>
							{deleteConfirm === item.id ? (
								<span className="space-x-2">
									<button
										type="button"
										onClick={() => handleDelete(item.id)}
										className="font-medium text-destructive text-xs"
									>
										Confirm
									</button>
									<button
										type="button"
										onClick={() => setDeleteConfirm(null)}
										className="text-muted-foreground text-xs"
									>
										Cancel
									</button>
								</span>
							) : (
								<button
									type="button"
									onClick={() => setDeleteConfirm(item.id)}
									className="text-muted-foreground text-xs hover:text-destructive"
								>
									Delete
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between border-border border-t px-5 py-3">
					<span className="text-muted-foreground text-sm">
						Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
					</span>
					<span className="space-x-2">
						<button
							type="button"
							onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
							disabled={skip === 0}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => setSkip((s) => s + PAGE_SIZE)}
							disabled={skip + PAGE_SIZE >= total}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Next
						</button>
					</span>
				</div>
			)}
		</>
	);

	return (
		<ComparisonAdminTemplate
			frequent={frequent}
			total={total}
			error={error}
			itemsContent={itemsContent}
			formatPrice={formatPrice}
		/>
	);
}
