"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import WrapOptionListTemplate from "./wrap-option-list.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WrapOptionItem {
	id: string;
	name: string;
	description?: string;
	priceInCents: number;
	imageUrl?: string;
	active: boolean;
	sortOrder: number;
	createdAt: string;
}

interface SummaryData {
	totalOptions: number;
	activeOptions: number;
	totalSelections: number;
	totalRevenue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
const labelCls = "mb-1 block font-medium text-foreground text-sm";
const PAGE_SIZE = 50;
const SKELETON_IDS = ["a", "b", "c"] as const;

function formatPrice(cents: number) {
	return cents === 0
		? "Free"
		: new Intl.NumberFormat(undefined, {
				style: "currency",
				currency: "USD",
			}).format(cents / 100);
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

// ─── API hook ─────────────────────────────────────────────────────────────────

function useGiftWrappingApi() {
	const client = useModuleClient();
	return {
		list: client.module("gift-wrapping").admin["/admin/gift-wrapping"],
		create: client.module("gift-wrapping").admin["/admin/gift-wrapping/create"],
		update:
			client.module("gift-wrapping").admin["/admin/gift-wrapping/:id/update"],
		remove:
			client.module("gift-wrapping").admin["/admin/gift-wrapping/:id/delete"],
		summary:
			client.module("gift-wrapping").admin["/admin/gift-wrapping/summary"],
	};
}

// ─── WrapOptionSheet ──────────────────────────────────────────────────────────

interface WrapOptionSheetProps {
	option?: WrapOptionItem;
	onSaved: () => void;
	onCancel: () => void;
}

function WrapOptionSheet({ option, onSaved, onCancel }: WrapOptionSheetProps) {
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
	const api = useGiftWrappingApi();
	const isEditing = !!option;

	const [name, setName] = useState(option?.name ?? "");
	const [description, setDescription] = useState(option?.description ?? "");
	const [price, setPrice] = useState(
		option ? String((option.priceInCents / 100).toFixed(2)) : "0",
	);
	const [sortOrder, setSortOrder] = useState(String(option?.sortOrder ?? 0));
	const [active, setActive] = useState(option?.active ?? true);
	const [error, setError] = useState("");

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!name.trim()) {
			setError("Name is required.");
			return;
		}
		const parsedPrice = Math.round(Number.parseFloat(price) * 100);
		if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
			setError("Enter a valid price.");
			return;
		}

		const body = {
			name: name.trim(),
			description: description.trim() || undefined,
			priceInCents: parsedPrice,
			sortOrder: Number.parseInt(sortOrder, 10) || 0,
			active,
		};

		if (isEditing) {
			updateMutation.mutate({ params: { id: option.id }, body });
		} else {
			createMutation.mutate({ body });
		}
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
					<h2 className="font-semibold text-foreground text-lg">
						{isEditing ? "Edit Option" : "New Option"}
					</h2>
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
						<div
							role="alert"
							className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
						>
							{error}
						</div>
					) : null}
					<div className="space-y-4">
						<div>
							<label htmlFor="gw-name" className={labelCls}>
								Name <span className="text-destructive">*</span>
							</label>
							<input
								id="gw-name"
								ref={firstInputRef}
								className={inputCls}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Standard Box"
							/>
						</div>
						<div>
							<label htmlFor="gw-desc" className={labelCls}>
								Description
							</label>
							<input
								id="gw-desc"
								className={inputCls}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Classic kraft paper with ribbon"
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label htmlFor="gw-price" className={labelCls}>
									Price ($)
								</label>
								<input
									id="gw-price"
									type="number"
									step="0.01"
									min="0"
									className={inputCls}
									value={price}
									onChange={(e) => setPrice(e.target.value)}
									placeholder="0.00"
								/>
							</div>
							<div>
								<label htmlFor="gw-sort" className={labelCls}>
									Sort order
								</label>
								<input
									id="gw-sort"
									type="number"
									min="0"
									className={inputCls}
									value={sortOrder}
									onChange={(e) => setSortOrder(e.target.value)}
								/>
							</div>
						</div>
						<label className="flex cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								checked={active}
								onChange={(e) => setActive(e.target.checked)}
								className="h-4 w-4 rounded border-border accent-foreground"
							/>
							<span className="text-foreground text-sm">Active</span>
						</label>
					</div>
					<div className="mt-auto flex justify-end gap-2 border-border border-t pt-4">
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{isPending
								? isEditing
									? "Saving..."
									: "Creating..."
								: isEditing
									? "Save Changes"
									: "Create Option"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WrapOptionList() {
	const api = useGiftWrappingApi();
	const [activeFilter, setActiveFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [editOption, setEditOption] = useState<WrapOptionItem | null>(null);

	const queryInput: Record<string, string> = { take: String(PAGE_SIZE) };
	if (activeFilter) queryInput.active = activeFilter;

	const { data: listData, isLoading: loading } = api.list.useQuery(
		queryInput,
	) as {
		data: { options: WrapOptionItem[] } | undefined;
		isLoading: boolean;
	};

	const { data: summaryData } = api.summary.useQuery({}) as {
		data: { summary: SummaryData } | undefined;
	};

	const deleteMutation = api.remove.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
		},
	});

	const options = listData?.options ?? [];
	const summary = summaryData?.summary;

	const handleDelete = (opt: WrapOptionItem) => {
		if (
			!window.confirm(
				`Delete wrapping option "${opt.name}"? This cannot be undone.`,
			)
		)
			return;
		deleteMutation.mutate({ params: { id: opt.id } });
	};

	return (
		<WrapOptionListTemplate>
			{/* Sheet overlays */}
			{showCreate ? (
				<WrapOptionSheet
					onSaved={() => setShowCreate(false)}
					onCancel={() => setShowCreate(false)}
				/>
			) : null}
			{editOption ? (
				<WrapOptionSheet
					option={editOption}
					onSaved={() => setEditOption(null)}
					onCancel={() => setEditOption(null)}
				/>
			) : null}

			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<h2 className="font-semibold text-foreground text-lg">
					Wrapping Options
				</h2>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Add Option
				</button>
			</div>

			{/* Summary */}
			{summary ? (
				<div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs">Total Options</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{summary.totalOptions}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs">Active</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{summary.activeOptions}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs">Selections</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{summary.totalSelections}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs">Revenue</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{formatPrice(summary.totalRevenue)}
						</p>
					</div>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4">
				<select
					value={activeFilter}
					onChange={(e) => setActiveFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				>
					<option value="">All</option>
					<option value="true">Active</option>
					<option value="false">Inactive</option>
				</select>
			</div>

			{/* List */}
			{loading ? (
				<div className="space-y-3">
					{SKELETON_IDS.map((id) => (
						<div
							key={`gw-skel-${id}`}
							className="h-14 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : options.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-10 text-center">
					<p className="font-medium text-foreground text-sm">
						No wrapping options yet
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Add an option to offer gift wrapping at checkout
					</p>
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
					>
						Add Option
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
									Price
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
									Sort
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
							{options.map((opt) => (
								<tr
									key={opt.id}
									className="transition-colors hover:bg-muted/50"
								>
									<td className="px-4 py-2 font-medium text-foreground">
										{opt.name}
										{opt.description ? (
											<span className="ml-2 font-normal text-muted-foreground text-xs">
												{opt.description}
											</span>
										) : null}
									</td>
									<td className="px-4 py-2 text-foreground text-xs">
										{formatPrice(opt.priceInCents)}
									</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												opt.active
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{opt.active ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{opt.sortOrder}
									</td>
									<td className="px-4 py-2">
										<div className="flex gap-1">
											<button
												type="button"
												onClick={() => setEditOption(opt)}
												className="rounded px-2 py-1 text-xs hover:bg-muted"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => handleDelete(opt)}
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
		</WrapOptionListTemplate>
	);
}
