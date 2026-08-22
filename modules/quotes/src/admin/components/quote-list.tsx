"use client";

import { useEffect, useRef, useState } from "react";
import {
	extractError,
	formatCurrency,
	inputCls,
	labelCls,
	type Quote,
	STATUS_COLORS,
	useQuotesApi,
} from "./_shared";

function QuoteSheet({ onSaved, onCancel }: QuoteSheetProps) {
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onCancel]);
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const api = useQuotesApi();
	const [customerEmail, setCustomerEmail] = useState("");
	const [customerName, setCustomerName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [notes, setNotes] = useState("");
	const [error, setError] = useState("");

	const createMutation = api.create.useMutation({
		onSuccess: (data: { quote?: { id: string } }) => {
			void api.list.invalidate();
			onSaved(data.quote?.id ?? "");
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!customerEmail.trim() || !customerName.trim()) {
			setError("Customer email and name are required.");
			return;
		}
		const body: Record<string, string> = {
			customerEmail: customerEmail.trim(),
			customerName: customerName.trim(),
		};
		if (companyName.trim()) body.companyName = companyName.trim();
		if (notes.trim()) body.notes = notes.trim();
		createMutation.mutate({ body });
	}

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-black/40"
				aria-label="Close panel"
				onClick={onCancel}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">New Quote</h2>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						✕
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-5 px-6 py-6"
				>
					{error ? (
						<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}

					<div>
						<label htmlFor="qs-email" className={labelCls}>
							Customer email <span className="text-red-500">*</span>
						</label>
						<input
							id="qs-email"
							type="email"
							ref={firstInputRef}
							value={customerEmail}
							onChange={(e) => setCustomerEmail(e.target.value)}
							className={inputCls}
							placeholder="customer@example.com"
							required
						/>
					</div>

					<div>
						<label htmlFor="qs-name" className={labelCls}>
							Customer name <span className="text-red-500">*</span>
						</label>
						<input
							id="qs-name"
							type="text"
							value={customerName}
							onChange={(e) => setCustomerName(e.target.value)}
							className={inputCls}
							placeholder="Jane Smith"
							required
						/>
					</div>

					<div>
						<label htmlFor="qs-company" className={labelCls}>
							Company (optional)
						</label>
						<input
							id="qs-company"
							type="text"
							value={companyName}
							onChange={(e) => setCompanyName(e.target.value)}
							className={inputCls}
							placeholder="Acme Inc."
						/>
					</div>

					<div>
						<label htmlFor="qs-notes" className={labelCls}>
							Notes (optional)
						</label>
						<textarea
							id="qs-notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className={inputCls}
							rows={3}
							placeholder="Internal notes or customer instructions…"
						/>
					</div>

					<div className="mt-auto flex gap-3 pt-4">
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="flex-1 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating…" : "Create Quote"}
						</button>
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

interface QuoteSheetProps {
	onSaved: (id: string) => void;
	onCancel: () => void;
}

export function QuoteList() {
	const api = useQuotesApi();
	const [showCreate, setShowCreate] = useState(false);

	const { data, isLoading } = api.list.useQuery({}) as {
		data: { quotes?: Quote[] } | undefined;
		isLoading: boolean;
	};

	const quotes = data?.quotes ?? [];

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Quotes</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage price quotes and proposals for customers
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Create Quote
				</button>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : quotes.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No quotes yet. Create a quote to send custom pricing proposals to
						customers.
					</p>
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
					>
						Create Quote
					</button>
				</div>
			) : (
				<div className="rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b text-left">
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Quote
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Customer
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Total
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{quotes.map((quote) => (
								<tr key={quote.id} className="hover:bg-muted/50">
									<td className="px-4 py-3">
										<a
											href={`/admin/quotes/${quote.id}`}
											className="font-medium text-foreground text-sm hover:underline"
										>
											#{quote.quoteNumber ?? quote.id.slice(0, 8)}
										</a>
										<p className="text-muted-foreground text-xs">
											{quote.itemCount ?? 0} item
											{(quote.itemCount ?? 0) !== 1 ? "s" : ""}
										</p>
									</td>
									<td className="px-4 py-3">
										<p className="text-foreground text-sm">
											{quote.customerName ?? quote.customerEmail}
										</p>
									</td>
									<td className="px-4 py-3 font-medium text-foreground text-sm">
										{formatCurrency(quote.total, quote.currency)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[quote.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{quote.status}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{showCreate ? (
				<QuoteSheet
					onSaved={(id) => {
						setShowCreate(false);
						if (id) window.location.assign(`/admin/quotes/${id}`);
					}}
					onCancel={() => setShowCreate(false)}
				/>
			) : null}
		</div>
	);
}
