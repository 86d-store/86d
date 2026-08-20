"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

interface TaxReportRow {
	jurisdiction: { country: string; state: string };
	totalTax: number;
	totalShippingTax: number;
	totalSubtotal: number;
	transactionCount: number;
	effectiveRate: number;
}

interface TaxTransactionRow {
	id: string;
	orderId?: string;
	country: string;
	state: string;
	city?: string;
	subtotal: number;
	totalTax: number;
	shippingTax: number;
	effectiveRate: number;
	inclusive: boolean;
	exempt: boolean;
	rateNames: string[];
	createdAt: string;
}

interface NexusRow {
	id: string;
	country: string;
	state: string;
	type: "physical" | "economic" | "voluntary";
	enabled: boolean;
	notes?: string;
	createdAt: string;
}

export function TaxReporting() {
	const client = useModuleClient();
	const [tab, setTab] = useState<"report" | "transactions" | "nexus">("report");
	const [filterCountry, setFilterCountry] = useState("");
	const [filterState, setFilterState] = useState("");
	const [nexusCountry, setNexusCountry] = useState("US");
	const [nexusState, setNexusState] = useState("");
	const [nexusType, setNexusType] = useState<
		"physical" | "economic" | "voluntary"
	>("physical");
	const [nexusNotes, setNexusNotes] = useState("");

	const taxAdmin = client.module("tax").admin;

	const reportQuery = taxAdmin["/admin/tax/report"].useQuery({
		...(filterCountry ? { country: filterCountry } : {}),
		...(filterState ? { state: filterState } : {}),
	}) as {
		data: { report?: TaxReportRow[] } | undefined;
		refetch: () => void;
		isError: boolean;
	};

	const transactionsQuery = taxAdmin["/admin/tax/transactions"].useQuery({
		...(filterCountry ? { country: filterCountry } : {}),
		...(filterState ? { state: filterState } : {}),
		limit: "50",
	}) as {
		data: { transactions?: TaxTransactionRow[] } | undefined;
	};

	const nexusQuery = taxAdmin["/admin/tax/nexus"].useQuery({}) as {
		data: { nexus?: NexusRow[] } | undefined;
		refetch: () => void;
	};

	const createNexusMutation = taxAdmin["/admin/tax/nexus/create"].useMutation();

	const deleteNexusMutation =
		taxAdmin["/admin/tax/nexus/:id/delete"].useMutation();

	if (reportQuery.isError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load tax report
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => void reportQuery.refetch()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const report: TaxReportRow[] = reportQuery.data?.report ?? [];
	const transactions: TaxTransactionRow[] =
		transactionsQuery.data?.transactions ?? [];
	const nexusList: NexusRow[] = nexusQuery.data?.nexus ?? [];

	const totalCollected = report.reduce((sum, r) => sum + r.totalTax, 0);
	const totalTransactions = report.reduce(
		(sum, r) => sum + r.transactionCount,
		0,
	);

	const handleCreateNexus = async () => {
		await createNexusMutation.mutateAsync({
			body: {
				country: nexusCountry,
				...(nexusState ? { state: nexusState } : {}),
				type: nexusType,
				...(nexusNotes ? { notes: nexusNotes } : {}),
			},
		});
		setNexusState("");
		setNexusNotes("");
		nexusQuery.refetch();
	};

	const handleDeleteNexus = async (id: string) => {
		await deleteNexusMutation.mutateAsync({ params: { id } });
		nexusQuery.refetch();
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl">Tax Reporting</h1>
				<div className="flex gap-2">
					{(["report", "transactions", "nexus"] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className={`rounded-md px-3 py-1.5 font-medium text-sm ${
								tab === t
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground"
							}`}
						>
							{t === "report"
								? "Summary"
								: t === "transactions"
									? "Transactions"
									: "Nexus"}
						</button>
					))}
				</div>
			</div>

			{/* Filters */}
			{tab !== "nexus" && (
				<div className="flex gap-3">
					<input
						type="text"
						placeholder="Country (e.g. US)"
						value={filterCountry}
						onChange={(e) => setFilterCountry(e.target.value)}
						className="rounded-md border px-3 py-1.5 text-sm"
						maxLength={2}
					/>
					<input
						type="text"
						placeholder="State (e.g. CA)"
						value={filterState}
						onChange={(e) => setFilterState(e.target.value)}
						className="rounded-md border px-3 py-1.5 text-sm"
						maxLength={10}
					/>
				</div>
			)}

			{/* Summary Tab */}
			{tab === "report" && (
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="rounded-lg border p-4">
							<p className="text-muted-foreground text-sm">
								Total Tax Collected
							</p>
							<p className="font-bold text-2xl">${totalCollected.toFixed(2)}</p>
						</div>
						<div className="rounded-lg border p-4">
							<p className="text-muted-foreground text-sm">
								Total Transactions
							</p>
							<p className="font-bold text-2xl">{totalTransactions}</p>
						</div>
					</div>
					<div className="overflow-auto rounded-lg border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b bg-muted/50">
									<th scope="col" className="px-4 py-2 text-left">
										Jurisdiction
									</th>
									<th scope="col" className="px-4 py-2 text-right">
										Tax Collected
									</th>
									<th scope="col" className="px-4 py-2 text-right">
										Shipping Tax
									</th>
									<th scope="col" className="px-4 py-2 text-right">
										Taxable Sales
									</th>
									<th scope="col" className="px-4 py-2 text-right">
										Transactions
									</th>
									<th scope="col" className="px-4 py-2 text-right">
										Eff. Rate
									</th>
								</tr>
							</thead>
							<tbody>
								{report.map((r) => (
									<tr
										key={`${r.jurisdiction.country}-${r.jurisdiction.state}`}
										className="border-b"
									>
										<td className="px-4 py-2">
											{r.jurisdiction.country} — {r.jurisdiction.state}
										</td>
										<td className="px-4 py-2 text-right">
											${r.totalTax.toFixed(2)}
										</td>
										<td className="px-4 py-2 text-right">
											${r.totalShippingTax.toFixed(2)}
										</td>
										<td className="px-4 py-2 text-right">
											${r.totalSubtotal.toFixed(2)}
										</td>
										<td className="px-4 py-2 text-right">
											{r.transactionCount}
										</td>
										<td className="px-4 py-2 text-right">
											{(r.effectiveRate * 100).toFixed(2)}%
										</td>
									</tr>
								))}
								{report.length === 0 && (
									<tr>
										<td
											colSpan={6}
											className="px-4 py-8 text-center text-muted-foreground"
										>
											No tax data for the selected period
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Transactions Tab */}
			{tab === "transactions" && (
				<div className="overflow-auto rounded-lg border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th scope="col" className="px-4 py-2 text-left">
									Date
								</th>
								<th scope="col" className="px-4 py-2 text-left">
									Order
								</th>
								<th scope="col" className="px-4 py-2 text-left">
									Jurisdiction
								</th>
								<th scope="col" className="px-4 py-2 text-right">
									Subtotal
								</th>
								<th scope="col" className="px-4 py-2 text-right">
									Tax
								</th>
								<th scope="col" className="px-4 py-2 text-right">
									Rate
								</th>
								<th scope="col" className="px-4 py-2 text-center">
									Status
								</th>
							</tr>
						</thead>
						<tbody>
							{transactions.map((t) => (
								<tr key={t.id} className="border-b">
									<td className="px-4 py-2">
										{new Date(t.createdAt).toLocaleDateString()}
									</td>
									<td className="px-4 py-2 font-mono text-xs">
										{t.orderId ?? "—"}
									</td>
									<td className="px-4 py-2">
										{t.country} — {t.state}
										{t.city ? ` — ${t.city}` : ""}
									</td>
									<td className="px-4 py-2 text-right">
										${t.subtotal.toFixed(2)}
									</td>
									<td className="px-4 py-2 text-right">
										${t.totalTax.toFixed(2)}
									</td>
									<td className="px-4 py-2 text-right">
										{(t.effectiveRate * 100).toFixed(2)}%
									</td>
									<td className="px-4 py-2 text-center">
										{t.exempt ? (
											<span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
												Exempt
											</span>
										) : t.inclusive ? (
											<span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800 text-xs">
												Inclusive
											</span>
										) : (
											<span className="rounded bg-green-100 px-2 py-0.5 text-green-800 text-xs">
												Collected
											</span>
										)}
									</td>
								</tr>
							))}
							{transactions.length === 0 && (
								<tr>
									<td
										colSpan={7}
										className="px-4 py-8 text-center text-muted-foreground"
									>
										No transactions recorded yet
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			)}

			{/* Nexus Tab */}
			{tab === "nexus" && (
				<div className="space-y-4">
					<p className="text-muted-foreground text-sm">
						Define jurisdictions where your store has tax collection
						obligations. When nexus records exist, tax is only collected in
						those jurisdictions.
					</p>

					{/* Create Nexus Form */}
					<div className="flex flex-wrap gap-3 rounded-lg border p-4">
						<select
							value={nexusCountry}
							onChange={(e) => setNexusCountry(e.target.value)}
							className="rounded-md border px-3 py-1.5 text-sm"
						>
							<option value="US">United States</option>
							<option value="CA">Canada</option>
							<option value="GB">United Kingdom</option>
							<option value="DE">Germany</option>
							<option value="FR">France</option>
							<option value="AU">Australia</option>
							<option value="JP">Japan</option>
						</select>
						<input
							type="text"
							placeholder="State (optional)"
							value={nexusState}
							onChange={(e) => setNexusState(e.target.value)}
							className="rounded-md border px-3 py-1.5 text-sm"
							maxLength={10}
						/>
						<select
							value={nexusType}
							onChange={(e) =>
								setNexusType(
									e.target.value as "physical" | "economic" | "voluntary",
								)
							}
							className="rounded-md border px-3 py-1.5 text-sm"
						>
							<option value="physical">Physical</option>
							<option value="economic">Economic</option>
							<option value="voluntary">Voluntary</option>
						</select>
						<input
							type="text"
							placeholder="Notes (optional)"
							value={nexusNotes}
							onChange={(e) => setNexusNotes(e.target.value)}
							className="flex-1 rounded-md border px-3 py-1.5 text-sm"
							maxLength={500}
						/>
						<button
							type="button"
							onClick={handleCreateNexus}
							className="rounded-md bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm"
						>
							Add Nexus
						</button>
					</div>

					{/* Nexus List */}
					<div className="overflow-auto rounded-lg border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b bg-muted/50">
									<th scope="col" className="px-4 py-2 text-left">
										Jurisdiction
									</th>
									<th scope="col" className="px-4 py-2 text-left">
										Type
									</th>
									<th scope="col" className="px-4 py-2 text-left">
										Notes
									</th>
									<th scope="col" className="px-4 py-2 text-left">
										Added
									</th>
									<th scope="col" className="px-4 py-2 text-right">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{nexusList.map((n) => (
									<tr key={n.id} className="border-b">
										<td className="px-4 py-2">
											{n.country}
											{n.state !== "*" ? ` — ${n.state}` : " (all states)"}
										</td>
										<td className="px-4 py-2">
											<span
												className={`rounded px-2 py-0.5 text-xs ${
													n.type === "physical"
														? "bg-blue-100 text-blue-800"
														: n.type === "economic"
															? "bg-purple-100 text-purple-800"
															: "bg-muted text-muted-foreground"
												}`}
											>
												{n.type}
											</span>
										</td>
										<td className="px-4 py-2 text-muted-foreground text-sm">
											{n.notes ?? "—"}
										</td>
										<td className="px-4 py-2">
											{new Date(n.createdAt).toLocaleDateString()}
										</td>
										<td className="px-4 py-2 text-right">
											<button
												type="button"
												onClick={() => handleDeleteNexus(n.id)}
												className="text-destructive text-xs hover:underline"
											>
												Remove
											</button>
										</td>
									</tr>
								))}
								{nexusList.length === 0 && (
									<tr>
										<td
											colSpan={5}
											className="px-4 py-8 text-center text-muted-foreground"
										>
											No nexus defined — tax is collected in all jurisdictions
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
