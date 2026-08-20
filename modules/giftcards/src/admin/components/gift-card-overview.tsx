"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import GiftCardOverviewTemplate from "./gift-card-overview.mdx";

interface GiftCard {
	id: string;
	code: string;
	initialBalance: number;
	currentBalance: number;
	currency: string;
	status: "active" | "disabled" | "expired" | "depleted";
	expiresAt?: string;
	recipientEmail?: string;
	customerId?: string;
	note?: string;
	createdAt: string;
	updatedAt: string;
}

interface GiftCardTransaction {
	id: string;
	giftCardId: string;
	type: "debit" | "credit";
	amount: number;
	balanceAfter: number;
	orderId?: string;
	note?: string;
	createdAt: string;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(amount);
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

const STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	disabled: "bg-muted text-muted-foreground",
	expired:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	depleted: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function useGiftCardAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("gift-cards").admin["/admin/gift-cards"],
		create: client.module("gift-cards").admin["/admin/gift-cards/create"],
		get: client.module("gift-cards").admin["/admin/gift-cards/:id"],
		update: client.module("gift-cards").admin["/admin/gift-cards/:id/update"],
		deleteCard:
			client.module("gift-cards").admin["/admin/gift-cards/:id/delete"],
		credit: client.module("gift-cards").admin["/admin/gift-cards/:id/credit"],
		transactions:
			client.module("gift-cards").admin["/admin/gift-cards/:id/transactions"],
	};
}

function CreateForm({ onClose }: { onClose: () => void }) {
	const api = useGiftCardAdminApi();
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState("USD");
	const [email, setEmail] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState("");

	const createMutation = api.create.useMutation({
		onSettled: () => {
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create gift card."));
		},
		onSuccess: () => {
			onClose();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const val = Number.parseFloat(amount);
		if (Number.isNaN(val) || val <= 0) {
			setError("Enter a valid amount.");
			return;
		}
		createMutation.mutate({
			initialBalance: val,
			currency,
			...(email ? { recipientEmail: email } : {}),
			...(expiresAt ? { expiresAt } : {}),
			...(note ? { note } : {}),
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<div
					role="alert"
					className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}
			<div className="grid grid-cols-2 gap-4">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Amount *
					</span>
					<input
						type="number"
						step="0.01"
						min="0.01"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						placeholder="50.00"
						required
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Currency
					</span>
					<select
						value={currency}
						onChange={(e) => setCurrency(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="USD">USD</option>
						<option value="EUR">EUR</option>
						<option value="GBP">GBP</option>
						<option value="CAD">CAD</option>
						<option value="AUD">AUD</option>
					</select>
				</label>
			</div>
			<label className="block">
				<span className="mb-1 block font-medium text-foreground text-sm">
					Recipient Email
				</span>
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="customer@example.com"
				/>
			</label>
			<label className="block">
				<span className="mb-1 block font-medium text-foreground text-sm">
					Expires On
				</span>
				<input
					type="date"
					value={expiresAt}
					onChange={(e) => setExpiresAt(e.target.value)}
					className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>
			<label className="block">
				<span className="mb-1 block font-medium text-foreground text-sm">
					Note
				</span>
				<textarea
					value={note}
					onChange={(e) => setNote(e.target.value)}
					rows={2}
					className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="Internal note..."
				/>
			</label>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onClose}
					className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={createMutation.isPending}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
				>
					{createMutation.isPending ? "Creating..." : "Create Gift Card"}
				</button>
			</div>
		</form>
	);
}

function DetailPanel({
	cardId,
	onClose,
}: {
	cardId: string;
	onClose: () => void;
}) {
	const api = useGiftCardAdminApi();
	const [creditAmount, setCreditAmount] = useState("");
	const [creditNote, setCreditNote] = useState("");
	const [error, setError] = useState("");
	const [showCredit, setShowCredit] = useState(false);

	const { data: cardData, isLoading: cardLoading } = api.get.useQuery({
		params: { id: cardId },
	}) as { data: { card: GiftCard } | undefined; isLoading: boolean };

	const { data: txnData, isLoading: txnLoading } = api.transactions.useQuery({
		params: { id: cardId },
		take: "50",
	}) as {
		data:
			| {
					transactions: GiftCardTransaction[];
					card: GiftCard;
			  }
			| undefined;
		isLoading: boolean;
	};

	const card = cardData?.card;
	const transactions = txnData?.transactions ?? [];

	const creditMutation = api.credit.useMutation({
		onSettled: () => {
			setCreditAmount("");
			setCreditNote("");
			setShowCredit(false);
			void api.get.invalidate();
			void api.transactions.invalidate();
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to apply credit."));
		},
	});

	const updateStatusMutation = api.update.useMutation({
		onSettled: () => {
			void api.get.invalidate();
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to update gift card status."));
		},
	});

	const handleCredit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const val = Number.parseFloat(creditAmount);
		if (Number.isNaN(val) || val <= 0) {
			setError("Enter a valid amount.");
			return;
		}
		creditMutation.mutate({
			params: { id: cardId },
			amount: val,
			...(creditNote ? { note: creditNote } : {}),
		});
	};

	if (cardLoading || txnLoading) {
		return (
			<div className="animate-pulse space-y-5">
				<div className="flex items-center justify-between">
					<div className="h-4 w-24 rounded bg-muted" />
					<div className="h-5 w-16 rounded-full bg-muted" />
				</div>
				<div className="rounded-lg border border-border bg-card p-5">
					<div className="h-3 w-12 rounded bg-muted" />
					<div className="mt-2 h-6 w-48 rounded bg-muted" />
					<div className="mt-4 grid grid-cols-2 gap-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i}>
								<div className="h-3 w-20 rounded bg-muted" />
								<div className="mt-1.5 h-4 w-28 rounded bg-muted" />
							</div>
						))}
					</div>
				</div>
				<div className="rounded-lg border border-border bg-card">
					<div className="border-border border-b px-5 py-3">
						<div className="h-4 w-36 rounded bg-muted" />
					</div>
					<div className="divide-y divide-border">
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between px-5 py-3"
							>
								<div className="h-4 w-24 rounded bg-muted" />
								<div className="h-3 w-20 rounded bg-muted" />
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (!card) {
		return (
			<div className="py-8 text-center text-muted-foreground text-sm">
				Gift card not found.
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onClose}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to list
				</button>
				<span
					className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_COLORS[card.status] ?? ""}`}
				>
					{card.status}
				</span>
			</div>

			<div className="rounded-lg border border-border bg-card p-5">
				<p className="font-mono text-muted-foreground text-xs">Code</p>
				<p className="mt-0.5 font-mono font-semibold text-foreground text-lg tracking-wider">
					{card.code}
				</p>

				<div className="mt-4 grid grid-cols-2 gap-4">
					<div>
						<p className="text-muted-foreground text-xs">Initial Balance</p>
						<p className="mt-0.5 font-semibold text-foreground">
							{formatCurrency(card.initialBalance, card.currency)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Current Balance</p>
						<p className="mt-0.5 font-semibold text-foreground">
							{formatCurrency(card.currentBalance, card.currency)}
						</p>
					</div>
					{card.recipientEmail && (
						<div>
							<p className="text-muted-foreground text-xs">Recipient</p>
							<p className="mt-0.5 text-foreground text-sm">
								{card.recipientEmail}
							</p>
						</div>
					)}
					{card.expiresAt && (
						<div>
							<p className="text-muted-foreground text-xs">Expires</p>
							<p className="mt-0.5 text-foreground text-sm">
								{formatDate(card.expiresAt)}
							</p>
						</div>
					)}
					<div>
						<p className="text-muted-foreground text-xs">Created</p>
						<p className="mt-0.5 text-foreground text-sm">
							{formatDate(card.createdAt)}
						</p>
					</div>
				</div>

				{card.note && (
					<div className="mt-4">
						<p className="text-muted-foreground text-xs">Note</p>
						<p className="mt-0.5 text-muted-foreground text-sm">{card.note}</p>
					</div>
				)}
			</div>

			{error && (
				<div
					role="alert"
					className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}

			{showCredit ? (
				<form
					onSubmit={handleCredit}
					className="rounded-lg border border-border bg-card p-4"
				>
					<h4 className="mb-3 font-semibold text-foreground text-sm">
						Add Credit
					</h4>
					<div className="grid grid-cols-2 gap-3">
						<input
							type="number"
							step="0.01"
							min="0.01"
							value={creditAmount}
							onChange={(e) => setCreditAmount(e.target.value)}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="Amount"
							required
						/>
						<input
							type="text"
							value={creditNote}
							onChange={(e) => setCreditNote(e.target.value)}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="Note (optional)"
						/>
					</div>
					<div className="mt-3 flex gap-2">
						<button
							type="submit"
							disabled={creditMutation.isPending}
							className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{creditMutation.isPending ? "Applying..." : "Apply Credit"}
						</button>
						<button
							type="button"
							onClick={() => setShowCredit(false)}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</form>
			) : (
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setShowCredit(true)}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
					>
						+ Add Credit
					</button>
					{card.status === "active" && (
						<button
							type="button"
							disabled={updateStatusMutation.isPending}
							onClick={() =>
								updateStatusMutation.mutate({
									params: { id: card.id },
									body: { status: "disabled" },
								})
							}
							className="rounded-md border border-border px-3 py-1.5 text-amber-700 text-sm hover:bg-muted disabled:opacity-50 dark:text-amber-400"
						>
							Disable
						</button>
					)}
					{card.status === "disabled" && (
						<button
							type="button"
							disabled={updateStatusMutation.isPending}
							onClick={() =>
								updateStatusMutation.mutate({
									params: { id: card.id },
									body: { status: "active" },
								})
							}
							className="rounded-md border border-border px-3 py-1.5 text-emerald-700 text-sm hover:bg-muted disabled:opacity-50 dark:text-emerald-400"
						>
							Enable
						</button>
					)}
				</div>
			)}

			<div className="rounded-lg border border-border bg-card">
				<div className="border-border border-b px-5 py-3">
					<h3 className="font-semibold text-foreground text-sm">
						Transaction History
					</h3>
				</div>
				{transactions.length === 0 ? (
					<div className="px-5 py-6 text-center text-muted-foreground text-sm">
						No transactions yet.
					</div>
				) : (
					<div className="divide-y divide-border">
						{transactions.map((txn) => (
							<div
								key={txn.id}
								className="flex items-center justify-between px-5 py-3"
							>
								<div>
									<span
										className={`font-medium text-sm ${txn.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
									>
										{txn.type === "credit" ? "+" : "-"}
										{formatCurrency(txn.amount, card.currency)}
									</span>
									{txn.note && (
										<p className="mt-0.5 text-muted-foreground text-xs">
											{txn.note}
										</p>
									)}
								</div>
								<div className="text-right">
									<p className="text-muted-foreground text-xs">
										{formatDate(txn.createdAt)}
									</p>
									<p className="mt-0.5 font-mono text-muted-foreground text-xs">
										Balance: {formatCurrency(txn.balanceAfter, card.currency)}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export function GiftCardOverview() {
	const api = useGiftCardAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data: listData, isLoading } = api.list.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { cards: GiftCard[]; total: number } | undefined;
		isLoading: boolean;
	};

	const cards = listData?.cards ?? [];
	const total = listData?.total ?? 0;

	const deleteMutation = api.deleteCard.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete gift card."));
		},
	});

	const toggleStatusMutation = api.update.useMutation({
		onSettled: () => void api.list.invalidate(),
		onError: (err: Error) => {
			setError(extractError(err, "Failed to update gift card status."));
		},
	});

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	if (selectedId) {
		return (
			<DetailPanel cardId={selectedId} onClose={() => setSelectedId(null)} />
		);
	}

	const tableContent =
		cards.length === 0 ? (
			<div className="px-5 py-8 text-center text-muted-foreground text-sm">
				No gift cards found.
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
									Code
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Balance
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Recipient
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Created
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
							{cards.map((card) => (
								<tr
									key={card.id}
									className="cursor-pointer hover:bg-muted/30"
									onClick={() => setSelectedId(card.id)}
								>
									<td className="px-5 py-3 font-mono text-foreground text-xs">
										{card.code}
									</td>
									<td className="px-5 py-3">
										<span className="font-medium text-foreground">
											{formatCurrency(card.currentBalance, card.currency)}
										</span>
										{card.currentBalance !== card.initialBalance && (
											<span className="ml-1 text-muted-foreground text-xs">
												of {formatCurrency(card.initialBalance, card.currency)}
											</span>
										)}
									</td>
									<td className="px-5 py-3">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[card.status] ?? ""}`}
										>
											{card.status}
										</span>
									</td>
									<td className="px-5 py-3 text-muted-foreground text-sm">
										{card.recipientEmail ?? "—"}
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{formatDate(card.createdAt)}
									</td>
									<td
										className="px-5 py-3"
										onClick={(e) => e.stopPropagation()}
										onKeyDown={(e) => e.stopPropagation()}
									>
										{deleteConfirm === card.id ? (
											<span className="space-x-2">
												<button
													type="button"
													onClick={() => handleDelete(card.id)}
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
											<span className="flex items-center gap-2">
												{(card.status === "active" ||
													card.status === "disabled") && (
													<button
														type="button"
														disabled={toggleStatusMutation.isPending}
														onClick={() =>
															toggleStatusMutation.mutate({
																params: { id: card.id },
																body: {
																	status:
																		card.status === "active"
																			? "disabled"
																			: "active",
																},
															})
														}
														className={`text-xs disabled:opacity-50 ${card.status === "active" ? "text-amber-600 hover:text-amber-800 dark:text-amber-400" : "text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"}`}
													>
														{card.status === "active" ? "Disable" : "Enable"}
													</button>
												)}
												<button
													type="button"
													onClick={() => setDeleteConfirm(card.id)}
													className="text-muted-foreground text-xs hover:text-destructive"
												>
													Delete
												</button>
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="divide-y divide-border md:hidden">
					{cards.map((card) => (
						<button
							key={card.id}
							type="button"
							onClick={() => setSelectedId(card.id)}
							className="w-full px-5 py-3 text-left"
						>
							<div className="flex items-start justify-between">
								<div>
									<p className="font-medium font-mono text-foreground text-sm">
										{card.code}
									</p>
									<p className="mt-0.5 text-muted-foreground text-sm">
										{formatCurrency(card.currentBalance, card.currency)}
									</p>
									{card.recipientEmail && (
										<p className="mt-0.5 text-muted-foreground text-xs">
											{card.recipientEmail}
										</p>
									)}
								</div>
								<span
									className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[card.status] ?? ""}`}
								>
									{card.status}
								</span>
							</div>
						</button>
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
		<GiftCardOverviewTemplate
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setSkip(0);
			}}
			onCreateClick={() => setShowCreate(true)}
			createForm={
				showCreate ? (
					<div className="rounded-lg border border-border bg-card p-5">
						<h3 className="mb-4 font-semibold text-foreground">
							Issue New Gift Card
						</h3>
						<CreateForm onClose={() => setShowCreate(false)} />
					</div>
				) : null
			}
			error={error}
			loading={isLoading}
			tableContent={tableContent}
		/>
	);
}
