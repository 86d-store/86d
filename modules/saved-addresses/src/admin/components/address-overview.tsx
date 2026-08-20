"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import AddressOverviewTemplate from "./address-overview.mdx";

interface Address {
	id: string;
	customerId: string;
	label?: string;
	firstName: string;
	lastName: string;
	company?: string;
	line1: string;
	line2?: string;
	city: string;
	state?: string;
	postalCode: string;
	country: string;
	phone?: string;
	isDefault: boolean;
	isDefaultBilling: boolean;
	createdAt: string;
	updatedAt: string;
}

interface SummaryData {
	totalAddresses: number;
	countryCounts: Array<{ country: string; count: number }>;
}

function useAddressAdminApi() {
	const client = useModuleClient();
	return {
		listAll: client.module("saved-addresses").admin["/admin/saved-addresses"],
		summary:
			client.module("saved-addresses").admin["/admin/saved-addresses/summary"],
		deleteAddress:
			client.module("saved-addresses").admin[
				"/admin/saved-addresses/:id/delete"
			],
	};
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

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

export function AddressOverview() {
	const api = useAddressAdminApi();
	const [countryFilter, setCountryFilter] = useState("");
	const [customerIdFilter, setCustomerIdFilter] = useState("");
	const [skip, setSkip] = useState(0);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [error, setError] = useState("");
	const take = 20;

	const queryInput: Record<string, string> = {
		take: String(take),
		skip: String(skip),
	};
	if (countryFilter) queryInput.country = countryFilter;
	if (customerIdFilter) queryInput.customerId = customerIdFilter;

	const { data, isLoading: loading } = api.listAll.useQuery(queryInput) as {
		data: { items: Address[]; total: number } | undefined;
		isLoading: boolean;
	};

	const { data: summaryData } = api.summary.useQuery({}) as {
		data: SummaryData | undefined;
	};

	const deleteMutation = api.deleteAddress.useMutation({
		onSuccess: () => {
			setConfirmDeleteId(null);
			setError("");
			void api.listAll.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete address."));
		},
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;
	const totalAddresses = summaryData?.totalAddresses ?? 0;
	const countryCounts = summaryData?.countryCounts ?? [];
	const uniqueCountries = countryCounts.length;
	const hasNext = skip + take < total;
	const hasPrev = skip > 0;

	const handleDelete = (id: string, customerId: string) => {
		if (confirmDeleteId === id) {
			deleteMutation.mutate({
				params: { id },
				body: { customerId },
			});
		} else {
			setConfirmDeleteId(id);
		}
	};

	const itemsContent = loading ? (
		<p className="py-12 text-center text-muted-foreground">
			Loading addresses...
		</p>
	) : items.length === 0 ? (
		<p className="py-12 text-center text-muted-foreground">
			No addresses found
		</p>
	) : (
		<>
			{/* Desktop table */}
			<div className="hidden overflow-x-auto rounded-lg border md:block">
				<table className="w-full text-sm">
					<thead className="border-b bg-muted/50">
						<tr>
							<th scope="col" className="px-4 py-3 text-left font-medium">
								Name
							</th>
							<th scope="col" className="px-4 py-3 text-left font-medium">
								Address
							</th>
							<th scope="col" className="px-4 py-3 text-left font-medium">
								Country
							</th>
							<th scope="col" className="px-4 py-3 text-left font-medium">
								Default
							</th>
							<th scope="col" className="px-4 py-3 text-left font-medium">
								Customer
							</th>
							<th scope="col" className="px-4 py-3 text-left font-medium">
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{items.map((addr) => (
							<tr key={addr.id} className="hover:bg-muted/30">
								<td className="px-4 py-3">
									<div className="font-medium">
										{addr.firstName} {addr.lastName}
									</div>
									{addr.label && (
										<span className="text-muted-foreground text-xs">
											{addr.label}
										</span>
									)}
								</td>
								<td className="max-w-[200px] px-4 py-3 text-xs">
									<div>{addr.line1}</div>
									<div className="text-muted-foreground">
										{addr.city}
										{addr.state ? `, ${addr.state}` : ""} {addr.postalCode}
									</div>
								</td>
								<td className="px-4 py-3 text-xs">{addr.country}</td>
								<td className="px-4 py-3">
									<div className="flex gap-1">
										{addr.isDefault && (
											<span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-400">
												Shipping
											</span>
										)}
										{addr.isDefaultBilling && (
											<span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
												Billing
											</span>
										)}
									</div>
								</td>
								<td className="px-4 py-3 font-mono text-xs">
									{addr.customerId.slice(0, 8)}...
								</td>
								<td className="px-4 py-3">
									<button
										type="button"
										onClick={() => handleDelete(addr.id, addr.customerId)}
										className="rounded px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
									>
										{confirmDeleteId === addr.id ? "Confirm?" : "Delete"}
									</button>
									{confirmDeleteId === addr.id && (
										<button
											type="button"
											onClick={() => setConfirmDeleteId(null)}
											className="ml-1 rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted"
										>
											Cancel
										</button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Mobile cards */}
			<div className="space-y-3 md:hidden">
				{items.map((addr) => (
					<div
						key={addr.id}
						className="rounded-lg border border-border bg-card p-4"
					>
						<div className="flex items-start justify-between">
							<div>
								<p className="font-medium text-sm">
									{addr.firstName} {addr.lastName}
								</p>
								{addr.label && (
									<p className="text-muted-foreground text-xs">{addr.label}</p>
								)}
							</div>
							<div className="flex gap-1">
								{addr.isDefault && (
									<span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-400">
										Shipping
									</span>
								)}
								{addr.isDefaultBilling && (
									<span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
										Billing
									</span>
								)}
							</div>
						</div>
						<p className="mt-2 text-xs">
							{addr.line1}
							<br />
							{addr.city}
							{addr.state ? `, ${addr.state}` : ""} {addr.postalCode}
						</p>
						<p className="text-muted-foreground text-xs">{addr.country}</p>
						<div className="mt-2 flex items-center justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								{addr.customerId.slice(0, 8)}...
							</span>
							<button
								type="button"
								onClick={() => handleDelete(addr.id, addr.customerId)}
								className="rounded px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
							>
								{confirmDeleteId === addr.id ? "Confirm?" : "Delete"}
							</button>
						</div>
						{confirmDeleteId === addr.id && (
							<div className="mt-1 text-right">
								<button
									type="button"
									onClick={() => setConfirmDeleteId(null)}
									className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted"
								>
									Cancel
								</button>
							</div>
						)}
					</div>
				))}
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between pt-4">
				<button
					type="button"
					disabled={!hasPrev}
					onClick={() => setSkip(Math.max(0, skip - take))}
					className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
				>
					Previous
				</button>
				<span className="text-muted-foreground text-sm">
					Showing {skip + 1}–{Math.min(skip + take, total)} of {total}
				</span>
				<button
					type="button"
					disabled={!hasNext}
					onClick={() => setSkip(skip + take)}
					className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
				>
					Next
				</button>
			</div>
		</>
	);

	return (
		<AddressOverviewTemplate
			summary={{ totalAddresses, uniqueCountries }}
			countryCounts={countryCounts}
			error={error}
			itemsContent={itemsContent}
			countryFilter={countryFilter}
			onCountryFilterChange={setCountryFilter}
			customerIdFilter={customerIdFilter}
			onCustomerIdFilterChange={(val: string) => {
				setCustomerIdFilter(val);
				setSkip(0);
			}}
			onCountrySelect={(c: string) => {
				setCountryFilter(c);
				setSkip(0);
			}}
			formatDate={formatDate}
		/>
	);
}
