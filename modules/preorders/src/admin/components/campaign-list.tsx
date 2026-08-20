"use client";

import { useState } from "react";
import {
	CAMPAIGN_STATUS_COLORS,
	type Campaign,
	formatCurrency,
	formatDate,
	usePreordersApi,
} from "./_shared";

interface PreorderSummary {
	totalCampaigns: number;
	activeCampaigns: number;
	totalItems: number;
	pendingItems: number;
	fulfilledItems: number;
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export function CampaignList() {
	const api = usePreordersApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [productId, setProductId] = useState("");
	const [productName, setProductName] = useState("");
	const [price, setPrice] = useState(0);
	const [paymentType, setPaymentType] = useState("full");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [estimatedShipDate, setEstimatedShipDate] = useState("");
	const [error, setError] = useState("");

	const { data, isLoading } = api.listCampaigns.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { campaigns?: Campaign[]; total?: number } | undefined;
		isLoading: boolean;
	};
	const { data: summaryData } = api.summary.useQuery({}) as {
		data: { summary?: PreorderSummary } | undefined;
	};

	const createMutation = api.createCampaign.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const activateMutation = api.activateCampaign.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const pauseMutation = api.pauseCampaign.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const completeMutation = api.completeCampaign.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const cancelMutation = api.cancelCampaign.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const campaigns = data?.campaigns ?? [];
	const summary = summaryData?.summary;

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!productId.trim() || !productName.trim() || !startDate) {
			setError("Product ID, name, and start date are required.");
			return;
		}
		try {
			await createMutation.mutateAsync({
				body: {
					productId: productId.trim(),
					productName: productName.trim(),
					price,
					paymentType,
					startDate,
					endDate: endDate || undefined,
					estimatedShipDate: estimatedShipDate || undefined,
				},
			});
			setProductId("");
			setProductName("");
			setPrice(0);
			setPaymentType("full");
			setStartDate("");
			setEndDate("");
			setEstimatedShipDate("");
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleAction = async (
		id: string,
		action: "activate" | "pause" | "complete" | "cancel",
	) => {
		try {
			switch (action) {
				case "activate":
					await activateMutation.mutateAsync({ params: { id } });
					break;
				case "pause":
					await pauseMutation.mutateAsync({ params: { id } });
					break;
				case "complete":
					await completeMutation.mutateAsync({ params: { id } });
					break;
				case "cancel":
					await cancelMutation.mutateAsync({
						params: { id },
						body: {},
					});
					break;
			}
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Preorders</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage preorder campaigns
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Create Campaign"}
				</button>
			</div>

			{/* Summary */}
			{summary ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Campaigns
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{summary.totalCampaigns}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Active
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{summary.activeCampaigns}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Items
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{summary.totalItems}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Pending
						</p>
						<p className="mt-1 font-bold text-2xl text-yellow-600">
							{summary.pendingItems}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Fulfilled
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{summary.fulfilledItems}
						</p>
					</div>
				</div>
			) : null}

			{/* Create form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Campaign
					</h2>
					{error ? (
						<div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}
					<form onSubmit={handleCreate} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Product ID
								</span>
								<input
									type="text"
									value={productId}
									onChange={(e) => setProductId(e.target.value)}
									placeholder="Product ID"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Product Name
								</span>
								<input
									type="text"
									value={productName}
									onChange={(e) => setProductName(e.target.value)}
									placeholder="Product name"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<div className="grid gap-4 sm:grid-cols-3">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Price (cents)
								</span>
								<input
									type="number"
									value={price}
									onChange={(e) =>
										setPrice(Number.parseInt(e.target.value, 10) || 0)
									}
									min={0}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Payment Type
								</span>
								<select
									value={paymentType}
									onChange={(e) => setPaymentType(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								>
									<option value="full">Full Payment</option>
									<option value="deposit">Deposit</option>
								</select>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Start Date
								</span>
								<input
									type="date"
									value={startDate}
									onChange={(e) => setStartDate(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">End Date</span>
								<input
									type="date"
									value={endDate}
									onChange={(e) => setEndDate(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Est. Ship Date
								</span>
								<input
									type="date"
									value={estimatedShipDate}
									onChange={(e) => setEstimatedShipDate(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create Campaign"}
						</button>
					</form>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="draft">Draft</option>
					<option value="active">Active</option>
					<option value="paused">Paused</option>
					<option value="completed">Completed</option>
					<option value="cancelled">Cancelled</option>
				</select>
			</div>

			{/* Campaign list */}
			{isLoading ? (
				<div className="space-y-3">
					{["sk-a", "sk-b", "sk-c", "sk-d"].map((k) => (
						<div
							key={k}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : campaigns.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No preorder campaigns found.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{campaigns.map((c) => (
						<div
							key={c.id}
							className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<a
											href={`/admin/preorders/campaigns/${c.id}`}
											className="font-medium text-foreground text-sm hover:underline"
										>
											{c.productName}
										</a>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${CAMPAIGN_STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{c.status}
										</span>
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										<span>{formatCurrency(c.price)}</span>
										<span>
											{c.paymentType === "deposit" ? "Deposit" : "Full Payment"}
										</span>
										<span>
											{formatDate(c.startDate)}
											{c.endDate ? ` – ${formatDate(c.endDate)}` : ""}
										</span>
										{c.totalOrdered > 0 ? (
											<span>{c.totalOrdered} ordered</span>
										) : null}
										{c.estimatedShipDate ? (
											<span>Ships ~{formatDate(c.estimatedShipDate)}</span>
										) : null}
									</div>
								</div>
								<div className="flex gap-1">
									{c.status === "draft" ? (
										<button
											type="button"
											onClick={() => handleAction(c.id, "activate")}
											className="rounded bg-green-50 px-2 py-1 text-green-700 text-xs hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
										>
											Activate
										</button>
									) : null}
									{c.status === "active" ? (
										<>
											<button
												type="button"
												onClick={() => handleAction(c.id, "pause")}
												className="rounded px-2 py-1 text-xs hover:bg-muted"
											>
												Pause
											</button>
											<button
												type="button"
												onClick={() => handleAction(c.id, "complete")}
												className="rounded px-2 py-1 text-xs hover:bg-muted"
											>
												Complete
											</button>
										</>
									) : null}
									{c.status === "paused" ? (
										<button
											type="button"
											onClick={() => handleAction(c.id, "activate")}
											className="rounded bg-green-50 px-2 py-1 text-green-700 text-xs hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
										>
											Resume
										</button>
									) : null}
									{c.status !== "cancelled" && c.status !== "completed" ? (
										<button
											type="button"
											onClick={() => handleAction(c.id, "cancel")}
											className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
										>
											Cancel
										</button>
									) : null}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
