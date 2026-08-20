"use client";

import { useState } from "react";
import {
	extractError,
	type FlashSale,
	STATUS_COLORS,
	STATUS_LABELS,
	slugify,
	useFlashSalesApi,
} from "./_shared";

interface FlashSaleStats {
	totalSales: number;
	draftSales: number;
	scheduledSales: number;
	activeSales: number;
	endedSales: number;
	totalProducts: number;
	totalUnitsSold: number;
}

const SALE_LIST_SKELETON_KEYS = ["skel-1", "skel-2", "skel-3"];

function formatDateTime(dateStr: string) {
	return new Date(dateStr).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function FlashSaleList() {
	const api = useFlashSalesApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	// Create form state
	const [newName, setNewName] = useState("");
	const [newSlug, setNewSlug] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [newStartsAt, setNewStartsAt] = useState("");
	const [newEndsAt, setNewEndsAt] = useState("");
	const [newStatus, setNewStatus] = useState("draft");
	const [error, setError] = useState("");

	const {
		data,
		isLoading,
		isError: salesError,
		refetch: refetchSales,
	} = api.list.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { sales?: FlashSale[]; total?: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: FlashSaleStats } | undefined;
	};

	const sales = data?.sales ?? [];
	const stats = statsData?.stats;

	const createMutation = api.create.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteMutation = api.remove.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!newName.trim() || !newStartsAt || !newEndsAt) {
			setError("Name, start date, and end date are required.");
			return;
		}
		try {
			await createMutation.mutateAsync({
				body: {
					name: newName.trim(),
					slug: newSlug.trim() || slugify(newName),
					description: newDescription.trim() || undefined,
					status: newStatus,
					startsAt: new Date(newStartsAt).toISOString(),
					endsAt: new Date(newEndsAt).toISOString(),
				},
			});
			setNewName("");
			setNewSlug("");
			setNewDescription("");
			setNewStartsAt("");
			setNewEndsAt("");
			setNewStatus("draft");
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Delete this flash sale?")) return;
		try {
			await deleteMutation.mutateAsync({ params: { id } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	if (salesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load flash sales
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchSales()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Flash Sales</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Create and manage time-limited flash sales
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Create flash sale"}
				</button>
			</div>

			{/* Stats */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Sales
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalSales}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Active
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{stats.activeSales}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Scheduled
						</p>
						<p className="mt-1 font-bold text-2xl text-blue-600">
							{stats.scheduledSales}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Products
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalProducts}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Units Sold
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalUnitsSold}
						</p>
					</div>
				</div>
			) : null}

			{/* Create form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Flash Sale
					</h2>
					{error ? (
						<div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}
					<form onSubmit={handleCreate} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Name</span>
								<input
									type="text"
									value={newName}
									onChange={(e) => {
										setNewName(e.target.value);
										if (!newSlug) {
											setNewSlug(slugify(e.target.value));
										}
									}}
									placeholder="Summer Blowout"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Slug</span>
								<input
									type="text"
									value={newSlug}
									onChange={(e) => setNewSlug(e.target.value)}
									placeholder="summer-blowout"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Description
							</span>
							<input
								type="text"
								value={newDescription}
								onChange={(e) => setNewDescription(e.target.value)}
								placeholder="Optional description"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<div className="grid gap-4 sm:grid-cols-3">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Status</span>
								<select
									value={newStatus}
									onChange={(e) => setNewStatus(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								>
									<option value="draft">Draft</option>
									<option value="scheduled">Scheduled</option>
									<option value="active">Active</option>
								</select>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Starts At
								</span>
								<input
									type="datetime-local"
									value={newStartsAt}
									onChange={(e) => setNewStartsAt(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Ends At</span>
								<input
									type="datetime-local"
									value={newEndsAt}
									onChange={(e) => setNewEndsAt(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create Flash Sale"}
						</button>
					</form>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4 flex gap-2">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="draft">Draft</option>
					<option value="scheduled">Scheduled</option>
					<option value="active">Active</option>
					<option value="ended">Ended</option>
				</select>
			</div>

			{/* Sale list */}
			{isLoading ? (
				<div className="space-y-3">
					{SALE_LIST_SKELETON_KEYS.map((key) => (
						<div
							key={key}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : sales.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No flash sales yet. Create one to start offering time-limited deals.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{sales.map((sale) => (
						<div
							key={sale.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<a
											href={`/admin/flash-sales/${sale.id}`}
											className="font-medium text-foreground text-sm hover:underline"
										>
											{sale.name}
										</a>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[sale.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{STATUS_LABELS[sale.status] ?? sale.status}
										</span>
									</div>
									<p className="mt-1 text-muted-foreground text-xs">
										{formatDateTime(sale.startsAt)} &mdash;{" "}
										{formatDateTime(sale.endsAt)}
									</p>
									{sale.description ? (
										<p className="mt-0.5 text-muted-foreground text-xs">
											{sale.description}
										</p>
									) : null}
								</div>
								<div className="flex gap-1">
									<a
										href={`/admin/flash-sales/${sale.id}`}
										className="rounded px-2 py-1 text-xs hover:bg-muted"
									>
										Manage
									</a>
									<button
										type="button"
										onClick={() => handleDelete(sale.id)}
										className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
									>
										Delete
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
