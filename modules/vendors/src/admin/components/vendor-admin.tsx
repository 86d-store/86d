"use client";

import { useEffect, useRef, useState } from "react";
import {
	extractError,
	inputCls,
	labelCls,
	useVendorsApi,
	type Vendor,
} from "./_shared";

interface VendorStats {
	totalVendors: number;
	activeVendors: number;
	pendingVendors: number;
	suspendedVendors: number;
}

function VendorSheet({ vendor, onSaved, onCancel }: VendorSheetProps) {
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
	const api = useVendorsApi();
	const isEditing = !!vendor;

	const [name, setName] = useState(vendor?.name ?? "");
	const [slug, setSlug] = useState(vendor?.slug ?? "");
	const [email, setEmail] = useState(vendor?.email ?? "");
	const [phone, setPhone] = useState(vendor?.phone ?? "");
	const [description, setDescription] = useState(vendor?.description ?? "");
	const [website, setWebsite] = useState(vendor?.website ?? "");
	const [commissionRate, setCommissionRate] = useState(
		String(vendor?.commissionRate ?? 10),
	);
	const [error, setError] = useState("");

	const createMutation = api.createVendor.useMutation({
		onSuccess: () => {
			void api.listVendors.invalidate();
			void api.stats.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.updateVendor.useMutation({
		onSuccess: () => {
			void api.listVendors.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!name.trim() || !email.trim()) {
			setError("Name and email are required.");
			return;
		}

		const autoSlug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");

		const body = {
			name: name.trim(),
			slug: slug.trim() || autoSlug,
			email: email.trim(),
			...(phone.trim() ? { phone: phone.trim() } : { phone: null }),
			...(description.trim()
				? { description: description.trim() }
				: { description: null }),
			...(website.trim() ? { website: website.trim() } : { website: null }),
			commissionRate: Number.parseFloat(commissionRate) || 0,
		};

		if (isEditing) {
			updateMutation.mutate({ params: { id: vendor.id }, body });
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
						{isEditing ? "Edit Vendor" : "New Vendor"}
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
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label htmlFor="vs-name" className={labelCls}>
									Name <span className="text-destructive">*</span>
								</label>
								<input
									id="vs-name"
									ref={firstInputRef}
									className={inputCls}
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Acme Supplies"
								/>
							</div>
							<div>
								<label htmlFor="vs-slug" className={labelCls}>
									Slug
								</label>
								<input
									id="vs-slug"
									className={inputCls}
									value={slug}
									onChange={(e) => setSlug(e.target.value)}
									placeholder="acme-supplies"
								/>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label htmlFor="vs-email" className={labelCls}>
									Email <span className="text-destructive">*</span>
								</label>
								<input
									id="vs-email"
									type="email"
									className={inputCls}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="vendor@example.com"
								/>
							</div>
							<div>
								<label htmlFor="vs-phone" className={labelCls}>
									Phone
								</label>
								<input
									id="vs-phone"
									type="tel"
									className={inputCls}
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									placeholder="(555) 000-0000"
								/>
							</div>
						</div>

						<div>
							<label htmlFor="vs-website" className={labelCls}>
								Website
							</label>
							<input
								id="vs-website"
								type="url"
								className={inputCls}
								value={website}
								onChange={(e) => setWebsite(e.target.value)}
								placeholder="https://vendor.com"
							/>
						</div>

						<div>
							<label htmlFor="vs-description" className={labelCls}>
								Description
							</label>
							<textarea
								id="vs-description"
								rows={3}
								className={inputCls}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Brief description of the vendor"
							/>
						</div>

						<div>
							<label htmlFor="vs-commission" className={labelCls}>
								Commission rate (%)
							</label>
							<input
								id="vs-commission"
								type="number"
								min="0"
								max="100"
								step="0.1"
								className={inputCls}
								value={commissionRate}
								onChange={(e) => setCommissionRate(e.target.value)}
							/>
						</div>
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
									: "Create Vendor"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

const SKELETON_IDS = ["a", "b", "c", "d"] as const;

const VENDOR_STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	closed: "bg-muted text-muted-foreground",
};

interface VendorSheetProps {
	vendor?: Vendor;
	onSaved: () => void;
	onCancel: () => void;
}

export function VendorAdmin() {
	const api = useVendorsApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [editVendor, setEditVendor] = useState<Vendor | null>(null);

	const {
		data,
		isLoading,
		isError: vendorsError,
		refetch: refetchVendors,
	} = api.listVendors.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { vendors?: Vendor[]; total?: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: VendorStats } | undefined;
	};

	const deleteVendorMutation = api.deleteVendor.useMutation({
		onSuccess: () => {
			void api.listVendors.invalidate();
			void api.stats.invalidate();
		},
	});

	const updateStatusMutation = api.updateStatus.useMutation({
		onSuccess: () => {
			void api.listVendors.invalidate();
			void api.stats.invalidate();
		},
	});

	if (vendorsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load vendors</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchVendors()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const vendors = data?.vendors ?? [];
	const stats = statsData?.stats;

	const handleDelete = (vendor: Vendor) => {
		if (
			!window.confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)
		)
			return;
		deleteVendorMutation.mutate({ params: { id: vendor.id } });
	};

	const handleStatusChange = (vendor: Vendor, newStatus: string) => {
		updateStatusMutation.mutate({
			params: { id: vendor.id },
			body: {
				status: newStatus as "pending" | "active" | "suspended" | "closed",
			},
		});
	};

	return (
		<div>
			{/* Sheet overlays */}
			{showCreate ? (
				<VendorSheet
					onSaved={() => setShowCreate(false)}
					onCancel={() => setShowCreate(false)}
				/>
			) : null}
			{editVendor ? (
				<VendorSheet
					vendor={editVendor}
					onSaved={() => setEditVendor(null)}
					onCancel={() => setEditVendor(null)}
				/>
			) : null}

			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Vendors</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage marketplace vendors
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Add Vendor
				</button>
			</div>

			{/* Stats */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{[
						{
							label: "Total",
							value: stats.totalVendors,
							cls: "text-foreground",
						},
						{
							label: "Active",
							value: stats.activeVendors,
							cls: "text-green-600",
						},
						{
							label: "Pending",
							value: stats.pendingVendors,
							cls: "text-yellow-600",
						},
						{
							label: "Suspended",
							value: stats.suspendedVendors,
							cls: "text-red-600",
						},
					].map(({ label, value, cls }) => (
						<div
							key={label}
							className="rounded-lg border border-border bg-card p-4"
						>
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								{label}
							</p>
							<p className={`mt-1 font-bold text-2xl ${cls}`}>{value}</p>
						</div>
					))}
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4">
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="pending">Pending</option>
					<option value="active">Active</option>
					<option value="suspended">Suspended</option>
					<option value="closed">Closed</option>
				</select>
			</div>

			{/* Vendor list */}
			{isLoading ? (
				<div className="space-y-3">
					{SKELETON_IDS.map((id) => (
						<div
							key={`vend-skel-${id}`}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : vendors.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-10 text-center">
					<p className="font-medium text-foreground text-sm">No vendors yet</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Add a vendor to your marketplace
					</p>
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
					>
						Add Vendor
					</button>
				</div>
			) : (
				<div className="space-y-3">
					{vendors.map((vendor) => (
						<div
							key={vendor.id}
							className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm">
											{vendor.name}
										</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${VENDOR_STATUS_COLORS[vendor.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{vendor.status}
										</span>
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										<span>{vendor.email}</span>
										<span>Commission: {vendor.commissionRate}%</span>
										{vendor.website ? <span>{vendor.website}</span> : null}
									</div>
									{vendor.description ? (
										<p className="mt-1.5 text-muted-foreground text-xs">
											{vendor.description}
										</p>
									) : null}
								</div>
								<div className="flex shrink-0 items-center gap-1">
									{/* Status change dropdown */}
									<select
										value={vendor.status}
										onChange={(e) => handleStatusChange(vendor, e.target.value)}
										disabled={updateStatusMutation.isPending}
										className="rounded border border-border bg-background px-2 py-1 text-xs"
										aria-label="Change status"
									>
										<option value="pending">Pending</option>
										<option value="active">Active</option>
										<option value="suspended">Suspended</option>
										<option value="closed">Closed</option>
									</select>
									<button
										type="button"
										onClick={() => setEditVendor(vendor)}
										className="rounded px-2 py-1 text-xs hover:bg-muted"
									>
										Edit
									</button>
									<button
										type="button"
										onClick={() => handleDelete(vendor)}
										disabled={deleteVendorMutation.isPending}
										className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
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
