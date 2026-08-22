"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

interface TagEntry {
	tag: string;
	count: number;
}

interface Customer {
	id: string;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	tags?: string[] | null;
}

interface ListResult {
	customers: Customer[];
	total: number;
	pages: number;
}

function useCustomersAdminApi() {
	const client = useModuleClient();
	return {
		listTags: client.module("customers").admin["/admin/customers/tags"],
		listCustomers: client.module("customers").admin["/admin/customers"],
		bulkTags: client.module("customers").admin["/admin/customers/bulk-tags"],
	};
}

export function CustomerTags() {
	const api = useCustomersAdminApi();
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
		new Set(),
	);
	const [bulkTagInput, setBulkTagInput] = useState("");
	const [page, setPage] = useState(1);

	const {
		data: tagsData,
		isLoading: tagsLoading,
		isError: tagsError,
		refetch: refetchTags,
	} = api.listTags.useQuery({}) as {
		data: { tags: TagEntry[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const tags = tagsData?.tags ?? [];

	const customerQuery: Record<string, string> = {
		page: String(page),
		limit: "20",
	};
	if (selectedTag) customerQuery.tag = selectedTag;

	const { data: customersData, isLoading: customersLoading } =
		api.listCustomers.useQuery(customerQuery) as {
			data: ListResult | undefined;
			isLoading: boolean;
		};

	const customers = customersData?.customers ?? [];
	const totalPages = customersData?.pages ?? 1;

	const bulkAddMutation = api.bulkTags.useMutation({
		onSuccess: () => {
			setBulkTagInput("");
			setSelectedCustomers(new Set());
			void api.listTags.invalidate();
			void api.listCustomers.invalidate();
		},
	});

	const bulkRemoveMutation = api.bulkTags.useMutation({
		onSuccess: () => {
			setSelectedCustomers(new Set());
			void api.listTags.invalidate();
			void api.listCustomers.invalidate();
		},
	});

	const handleBulkAdd = () => {
		const tag = bulkTagInput.trim();
		if (!tag || selectedCustomers.size === 0) return;
		bulkAddMutation.mutate({
			action: "add",
			customerIds: [...selectedCustomers],
			tags: [tag],
		});
	};

	const handleBulkRemoveTag = (tag: string) => {
		if (selectedCustomers.size === 0) return;
		bulkRemoveMutation.mutate({
			action: "remove",
			customerIds: [...selectedCustomers],
			tags: [tag],
		});
	};

	const toggleCustomer = (id: string) => {
		setSelectedCustomers((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const toggleAll = () => {
		if (selectedCustomers.size === customers.length) {
			setSelectedCustomers(new Set());
		} else {
			setSelectedCustomers(new Set(customers.map((c) => c.id)));
		}
	};

	if (tagsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load customer tags
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchTags()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Customer Tags</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{tags.length} {tags.length === 1 ? "tag" : "tags"} across all
					customers
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-4">
				{/* Tag list sidebar */}
				<div className="space-y-2">
					<h2 className="font-semibold text-foreground text-sm">All Tags</h2>
					{tagsLoading ? (
						<div className="space-y-2">
							{(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
								<div key={key} className="h-8 animate-pulse rounded bg-muted" />
							))}
						</div>
					) : tags.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No tags yet. Add tags to customers from their detail page.
						</p>
					) : (
						<div className="space-y-1">
							<button
								type="button"
								onClick={() => {
									setSelectedTag(null);
									setPage(1);
								}}
								className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
									selectedTag === null
										? "bg-foreground text-background"
										: "text-foreground hover:bg-muted"
								}`}
							>
								All customers
							</button>
							{tags.map((t) => (
								<button
									key={t.tag}
									type="button"
									onClick={() => {
										setSelectedTag(t.tag);
										setPage(1);
									}}
									className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
										selectedTag === t.tag
											? "bg-foreground text-background"
											: "text-foreground hover:bg-muted"
									}`}
								>
									<span>{t.tag}</span>
									<span
										className={`rounded-full px-1.5 py-0.5 text-xs ${
											selectedTag === t.tag
												? "bg-background/20 text-background"
												: "bg-muted text-muted-foreground"
										}`}
									>
										{t.count}
									</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Customer list */}
				<div className="lg:col-span-3">
					{/* Bulk actions bar */}
					{selectedCustomers.size > 0 && (
						<div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
							<span className="font-medium text-foreground text-sm">
								{selectedCustomers.size} selected
							</span>
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={bulkTagInput}
									onChange={(e) => setBulkTagInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleBulkAdd();
										}
									}}
									placeholder="Tag name…"
									className="h-7 w-32 rounded border border-border bg-background px-2 text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								/>
								<button
									type="button"
									onClick={handleBulkAdd}
									disabled={!bulkTagInput.trim() || bulkAddMutation.isPending}
									className="h-7 rounded bg-foreground px-2.5 font-medium text-background text-xs hover:opacity-90 disabled:opacity-50"
								>
									Add tag
								</button>
							</div>
							{selectedTag && (
								<button
									type="button"
									onClick={() => handleBulkRemoveTag(selectedTag)}
									disabled={bulkRemoveMutation.isPending}
									className="h-7 rounded border border-destructive/50 px-2.5 font-medium text-destructive text-xs hover:bg-destructive/10 disabled:opacity-50"
								>
									Remove &ldquo;{selectedTag}&rdquo;
								</button>
							)}
						</div>
					)}

					<div className="overflow-hidden rounded-lg border border-border bg-card">
						<table className="w-full">
							<thead>
								<tr className="border-border border-b bg-muted/50">
									<th scope="col" className="w-10 px-4 py-3">
										<input
											type="checkbox"
											checked={
												customers.length > 0 &&
												selectedCustomers.size === customers.length
											}
											onChange={toggleAll}
											className="rounded border-border"
										/>
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Name
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Email
									</th>
									<th
										scope="col"
										className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
									>
										Tags
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{customersLoading ? (
									(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
										<tr key={key}>
											<td className="px-4 py-3" colSpan={4}>
												<div className="h-4 w-full animate-pulse rounded bg-muted" />
											</td>
										</tr>
									))
								) : customers.length === 0 ? (
									<tr>
										<td
											colSpan={4}
											className="px-4 py-12 text-center text-muted-foreground text-sm"
										>
											{selectedTag
												? `No customers with tag "${selectedTag}"`
												: "No customers yet"}
										</td>
									</tr>
								) : (
									customers.map((c) => (
										<tr
											key={c.id}
											className="transition-colors hover:bg-muted/30"
										>
											<td className="px-4 py-3">
												<input
													type="checkbox"
													checked={selectedCustomers.has(c.id)}
													onChange={() => toggleCustomer(c.id)}
													className="rounded border-border"
												/>
											</td>
											<td className="px-4 py-3 font-medium text-sm">
												<a
													href={`/admin/customers/${c.id}`}
													className="text-foreground hover:underline"
												>
													{c.firstName || c.lastName
														? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
														: "—"}
												</a>
											</td>
											<td className="px-4 py-3 text-foreground text-sm">
												{c.email}
											</td>
											<td className="hidden px-4 py-3 sm:table-cell">
												<div className="flex flex-wrap gap-1">
													{(c.tags ?? []).length > 0 ? (
														(c.tags ?? []).map((tag) => (
															<span
																key={tag}
																className="inline-flex rounded-full bg-foreground/10 px-2 py-0.5 font-medium text-foreground text-xs"
															>
																{tag}
															</span>
														))
													) : (
														<span className="text-muted-foreground text-sm">
															—
														</span>
													)}
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					{totalPages > 1 && (
						<div className="mt-4 flex items-center justify-center gap-2">
							<button
								type="button"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page === 1}
								className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
							>
								Previous
							</button>
							<span className="text-muted-foreground text-sm">
								Page {page} of {totalPages}
							</span>
							<button
								type="button"
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page === totalPages}
								className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
							>
								Next
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
