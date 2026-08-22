"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import FulfillmentAdminTemplate from "./fulfillment-admin.mdx";

interface FulfillmentItem {
	lineItemId: string;
	quantity: number;
}

interface Fulfillment {
	id: string;
	orderId: string;
	status: string;
	items: FulfillmentItem[];
	carrier?: string | null;
	trackingNumber?: string | null;
	trackingUrl?: string | null;
	notes?: string | null;
	shippedAt?: string | null;
	deliveredAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

type StatusFilter =
	| ""
	| "pending"
	| "processing"
	| "shipped"
	| "delivered"
	| "cancelled";

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	shipped:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	delivered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const NEXT_STATUS: Record<string, string> = {
	pending: "processing",
	processing: "shipped",
	shipped: "delivered",
};

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function useFulfillmentAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("fulfillment").admin["/admin/fulfillment"],
		create: client.module("fulfillment").admin["/admin/fulfillment/create"],
		get: client.module("fulfillment").admin["/admin/fulfillment/:id"],
		updateStatus:
			client.module("fulfillment").admin["/admin/fulfillment/:id/status"],
		addTracking:
			client.module("fulfillment").admin["/admin/fulfillment/:id/tracking"],
		cancel: client.module("fulfillment").admin["/admin/fulfillment/:id/cancel"],
	};
}

function StatusBadge({ status }: { status: string }) {
	return (
		<span
			className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
		>
			{status}
		</span>
	);
}

function FulfillmentRow({
	fulfillment,
	onAdvance,
	onCancel,
	onAddTracking,
}: {
	fulfillment: Fulfillment;
	onAdvance: () => void;
	onCancel: () => void;
	onAddTracking: () => void;
}) {
	const nextStatus = NEXT_STATUS[fulfillment.status];
	const canCancel =
		fulfillment.status !== "delivered" && fulfillment.status !== "cancelled";

	return (
		<tr className="transition-colors hover:bg-muted/20">
			<td className="px-4 py-3 font-mono text-foreground text-xs">
				{fulfillment.id.slice(0, 8)}...
			</td>
			<td className="px-4 py-3 font-mono text-foreground text-xs">
				{fulfillment.orderId.slice(0, 8)}...
			</td>
			<td className="px-4 py-3">
				<StatusBadge status={fulfillment.status} />
			</td>
			<td className="hidden px-4 py-3 text-foreground text-sm md:table-cell">
				{fulfillment.items.length} item
				{fulfillment.items.length !== 1 ? "s" : ""}
			</td>
			<td className="hidden px-4 py-3 text-sm lg:table-cell">
				{fulfillment.carrier ? (
					<span className="text-foreground">
						{fulfillment.carrier}
						{fulfillment.trackingNumber
							? ` #${fulfillment.trackingNumber}`
							: ""}
					</span>
				) : (
					<span className="text-muted-foreground">No tracking</span>
				)}
			</td>
			<td className="px-4 py-3 text-muted-foreground text-xs">
				{new Date(fulfillment.createdAt).toLocaleDateString()}
			</td>
			<td className="px-4 py-3 text-right">
				<div className="flex items-center justify-end gap-1">
					{!fulfillment.carrier && canCancel && (
						<button
							type="button"
							onClick={onAddTracking}
							className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
						>
							Track
						</button>
					)}
					{nextStatus && (
						<button
							type="button"
							onClick={onAdvance}
							className="rounded px-2 py-1 text-blue-600 text-xs hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
						>
							→ {nextStatus}
						</button>
					)}
					{canCancel && (
						<button
							type="button"
							onClick={onCancel}
							className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
						>
							Cancel
						</button>
					)}
				</div>
			</td>
		</tr>
	);
}

interface CreateForm {
	orderId: string;
	items: string;
	notes: string;
}

interface TrackingForm {
	carrier: string;
	trackingNumber: string;
	trackingUrl: string;
}

const DEFAULT_CREATE: CreateForm = { orderId: "", items: "", notes: "" };
const DEFAULT_TRACKING: TrackingForm = {
	carrier: "",
	trackingNumber: "",
	trackingUrl: "",
};

export function FulfillmentAdmin() {
	const api = useFulfillmentAdminApi();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
	const createOrderIdRef = useRef<HTMLInputElement>(null);
	const trackingCarrierRef = useRef<HTMLInputElement>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [createForm, setCreateForm] = useState<CreateForm>(DEFAULT_CREATE);
	const [trackingTarget, setTrackingTarget] = useState<string | null>(null);
	const [trackingForm, setTrackingForm] =
		useState<TrackingForm>(DEFAULT_TRACKING);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const queryParams: Record<string, string> = {};
	if (statusFilter) queryParams.status = statusFilter;

	const { data: listData, isLoading: loading } = api.list.useQuery({
		query: queryParams,
	}) as {
		data: { fulfillments: Fulfillment[] } | undefined;
		isLoading: boolean;
	};

	const fulfillments = listData?.fulfillments ?? [];

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			setShowCreate(false);
			setCreateForm(DEFAULT_CREATE);
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create fulfillment"));
		},
		onSettled: () => setSaving(false),
	});

	const statusMutation = api.updateStatus.useMutation({
		onSettled: () => void api.list.invalidate(),
	});

	const cancelMutation = api.cancel.useMutation({
		onSettled: () => void api.list.invalidate(),
	});

	const trackingMutation = api.addTracking.useMutation({
		onSuccess: () => {
			setTrackingTarget(null);
			setTrackingForm(DEFAULT_TRACKING);
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to add tracking"));
		},
		onSettled: () => setSaving(false),
	});

	useEffect(() => {
		if (!showCreate) return;
		createOrderIdRef.current?.focus();
	}, [showCreate]);
	useEffect(() => {
		if (!showCreate) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowCreate(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showCreate]);

	useEffect(() => {
		if (!trackingTarget) return;
		trackingCarrierRef.current?.focus();
	}, [trackingTarget]);
	useEffect(() => {
		if (!trackingTarget) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setTrackingTarget(null);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [trackingTarget]);

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError("");

		const items = createForm.items
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => {
				const [lineItemId, qty] = line.split(",").map((s) => s.trim());
				return { lineItemId, quantity: Number.parseInt(qty, 10) || 1 };
			});

		if (items.length === 0) {
			setError("Add at least one item (lineItemId, quantity per line)");
			setSaving(false);
			return;
		}

		const body: Record<string, unknown> = {
			orderId: createForm.orderId,
			items,
		};
		if (createForm.notes) body.notes = createForm.notes;
		createMutation.mutate(body);
	}

	function handleAdvance(f: Fulfillment) {
		const next = NEXT_STATUS[f.status];
		if (!next) return;
		statusMutation.mutate({ params: { id: f.id }, status: next });
	}

	function handleCancel(f: Fulfillment) {
		if (!confirm("Cancel this fulfillment?")) return;
		cancelMutation.mutate({ params: { id: f.id } });
	}

	function handleTracking(e: React.FormEvent) {
		e.preventDefault();
		if (!trackingTarget) return;
		setSaving(true);
		setError("");
		const body: Record<string, unknown> = {
			params: { id: trackingTarget },
			carrier: trackingForm.carrier,
			trackingNumber: trackingForm.trackingNumber,
		};
		if (trackingForm.trackingUrl) body.trackingUrl = trackingForm.trackingUrl;
		trackingMutation.mutate(body);
	}

	const subtitle = `${fulfillments.length} fulfillment${fulfillments.length !== 1 ? "s" : ""}`;

	return (
		<FulfillmentAdminTemplate
			subtitle={subtitle}
			onCreateFulfillment={() => {
				setCreateForm(DEFAULT_CREATE);
				setShowCreate(true);
			}}
			filters={
				<div className="mb-4 flex gap-2">
					{(
						[
							"",
							"pending",
							"processing",
							"shipped",
							"delivered",
							"cancelled",
						] as const
					).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setStatusFilter(s)}
							className={`rounded-full px-3 py-1 text-xs transition-colors ${
								statusFilter === s
									? "bg-foreground text-background"
									: "bg-muted text-muted-foreground hover:bg-muted/80"
							}`}
						>
							{s || "All"}
						</button>
					))}
				</div>
			}
			content={
				<>
					<div className="overflow-hidden rounded-lg border border-border bg-card">
						<table className="w-full">
							<thead>
								<tr className="border-border border-b bg-muted/50">
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										ID
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Order
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Status
									</th>
									<th
										scope="col"
										className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
									>
										Items
									</th>
									<th
										scope="col"
										className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
									>
										Tracking
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Created
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{loading ? (
									(["k0", "k1", "k2"] as const).map((key) => (
										<tr key={key}>
											{(
												["k0", "k1", "k2", "k3", "k4", "k5", "k6"] as const
											).map((key) => (
												<td key={key} className="px-4 py-3">
													<div className="h-4 w-20 animate-pulse rounded bg-muted" />
												</td>
											))}
										</tr>
									))
								) : fulfillments.length === 0 ? (
									<tr>
										<td colSpan={7} className="px-4 py-12 text-center">
											<p className="font-medium text-foreground text-sm">
												No fulfillments
											</p>
											<p className="mt-1 text-muted-foreground text-xs">
												Create a fulfillment from an order to start tracking
												shipments
											</p>
										</td>
									</tr>
								) : (
									fulfillments.map((f) => (
										<FulfillmentRow
											key={f.id}
											fulfillment={f}
											onAdvance={() => handleAdvance(f)}
											onCancel={() => handleCancel(f)}
											onAddTracking={() => {
												setTrackingTarget(f.id);
												setTrackingForm(DEFAULT_TRACKING);
											}}
										/>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Create Fulfillment Modal */}
					{showCreate && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div
								role="dialog"
								aria-modal="true"
								className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
							>
								<h2 className="mb-4 font-semibold text-foreground text-lg">
									Create fulfillment
								</h2>
								{error && (
									<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
										{error}
									</p>
								)}
								<form onSubmit={(e) => handleCreate(e)} className="space-y-4">
									<div>
										<label
											htmlFor="ff-order-id"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Order ID <span className="text-red-500">*</span>
										</label>
										<input
											ref={createOrderIdRef}
											id="ff-order-id"
											required
											value={createForm.orderId}
											onChange={(e) =>
												setCreateForm((f) => ({
													...f,
													orderId: e.target.value,
												}))
											}
											placeholder="Order ID"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="ff-items"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Items <span className="text-red-500">*</span>
										</label>
										<textarea
											id="ff-items"
											required
											rows={3}
											value={createForm.items}
											onChange={(e) =>
												setCreateForm((f) => ({
													...f,
													items: e.target.value,
												}))
											}
											placeholder={"lineItemId, quantity\nitem-abc, 2"}
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										<p className="mt-1 text-muted-foreground text-xs">
											One item per line: lineItemId, quantity
										</p>
									</div>
									<div>
										<label
											htmlFor="ff-notes"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Notes
										</label>
										<textarea
											id="ff-notes"
											rows={2}
											value={createForm.notes}
											onChange={(e) =>
												setCreateForm((f) => ({
													...f,
													notes: e.target.value,
												}))
											}
											placeholder="Internal notes (optional)"
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div className="flex justify-end gap-3 pt-2">
										<button
											type="button"
											onClick={() => setShowCreate(false)}
											className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
										>
											{saving ? "Creating..." : "Create"}
										</button>
									</div>
								</form>
							</div>
						</div>
					)}

					{/* Add Tracking Modal */}
					{trackingTarget && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div
								role="dialog"
								aria-modal="true"
								className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
							>
								<h2 className="mb-4 font-semibold text-foreground text-lg">
									Add tracking
								</h2>
								{error && (
									<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
										{error}
									</p>
								)}
								<form onSubmit={(e) => handleTracking(e)} className="space-y-4">
									<div>
										<label
											htmlFor="ff-carrier"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Carrier <span className="text-red-500">*</span>
										</label>
										<input
											ref={trackingCarrierRef}
											id="ff-carrier"
											required
											value={trackingForm.carrier}
											onChange={(e) =>
												setTrackingForm((f) => ({
													...f,
													carrier: e.target.value,
												}))
											}
											placeholder="e.g. UPS, FedEx, USPS, DHL"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="ff-tracking-number"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Tracking number <span className="text-red-500">*</span>
										</label>
										<input
											id="ff-tracking-number"
											required
											value={trackingForm.trackingNumber}
											onChange={(e) =>
												setTrackingForm((f) => ({
													...f,
													trackingNumber: e.target.value,
												}))
											}
											placeholder="Tracking number"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="ff-tracking-url"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Tracking URL
										</label>
										<input
											id="ff-tracking-url"
											type="url"
											value={trackingForm.trackingUrl}
											onChange={(e) =>
												setTrackingForm((f) => ({
													...f,
													trackingUrl: e.target.value,
												}))
											}
											placeholder="https://... (optional)"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div className="flex justify-end gap-3 pt-2">
										<button
											type="button"
											onClick={() => setTrackingTarget(null)}
											className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
										>
											{saving ? "Saving..." : "Add tracking"}
										</button>
									</div>
								</form>
							</div>
						</div>
					)}
				</>
			}
		/>
	);
}
