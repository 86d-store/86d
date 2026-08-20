"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import ShipmentsAdminTemplate from "./shipments-admin.mdx";

type ShipmentStatus =
	| "pending"
	| "shipped"
	| "in_transit"
	| "delivered"
	| "returned"
	| "failed";

interface Shipment {
	id: string;
	orderId: string;
	carrierId?: string | null;
	methodId?: string | null;
	trackingNumber?: string | null;
	status: ShipmentStatus;
	shippedAt?: string | null;
	deliveredAt?: string | null;
	estimatedDelivery?: string | null;
	notes?: string | null;
	labelUrl?: string | null;
	publicTrackingUrl?: string | null;
	createdAt: string;
}

interface ShippingCarrier {
	id: string;
	name: string;
	code: string;
}

const STATUS_LABELS: Record<ShipmentStatus, string> = {
	pending: "Pending",
	shipped: "Shipped",
	in_transit: "In Transit",
	delivered: "Delivered",
	returned: "Returned",
	failed: "Failed",
};

const STATUS_STYLES: Record<ShipmentStatus, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	in_transit:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	delivered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	returned:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

/** Valid next statuses per current status */
const STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
	pending: ["shipped", "failed"],
	shipped: ["in_transit", "delivered", "returned", "failed"],
	in_transit: ["delivered", "returned", "failed"],
	delivered: ["returned"],
	returned: [],
	failed: [],
};

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(dateStr));
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

function useShipmentsApi() {
	const client = useModuleClient();
	return {
		listShipments: client.module("shipping").admin["/admin/shipping/shipments"],
		createShipment:
			client.module("shipping").admin["/admin/shipping/shipments/create"],
		updateStatus:
			client.module("shipping").admin["/admin/shipping/shipments/:id/status"],
		deleteShipment:
			client.module("shipping").admin["/admin/shipping/shipments/:id/delete"],
		listCarriers: client.module("shipping").admin["/admin/shipping/carriers"],
	};
}

const ALL_STATUSES: ShipmentStatus[] = [
	"pending",
	"shipped",
	"in_transit",
	"delivered",
	"returned",
	"failed",
];

interface CreateShipmentForm {
	orderId: string;
	carrierId: string;
	trackingNumber: string;
	notes: string;
}

const DEFAULT_FORM: CreateShipmentForm = {
	orderId: "",
	carrierId: "",
	trackingNumber: "",
	notes: "",
};

function ShipmentRow({
	shipment,
	carriers,
	onUpdateStatus,
	onDelete,
}: {
	shipment: Shipment;
	carriers: ShippingCarrier[];
	onUpdateStatus: (id: string, status: ShipmentStatus) => void;
	onDelete: (id: string) => void;
}) {
	const carrier = carriers.find((c) => c.id === shipment.carrierId);
	const nextStatuses = STATUS_TRANSITIONS[shipment.status];

	return (
		<tr className="transition-colors hover:bg-muted/20">
			<td className="px-4 py-3">
				<span className="font-medium text-foreground text-sm">
					{shipment.orderId}
				</span>
			</td>
			<td className="px-4 py-3">
				<span
					className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_STYLES[shipment.status]}`}
				>
					{STATUS_LABELS[shipment.status]}
				</span>
			</td>
			<td className="hidden px-4 py-3 md:table-cell">
				{carrier ? (
					<span className="text-foreground text-sm">{carrier.name}</span>
				) : (
					<span className="text-muted-foreground/50 text-xs">—</span>
				)}
			</td>
			<td className="hidden px-4 py-3 lg:table-cell">
				{shipment.trackingNumber ? (
					<div className="flex items-center gap-1.5">
						<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">
							{shipment.trackingNumber}
						</code>
						{shipment.publicTrackingUrl && (
							<a
								href={shipment.publicTrackingUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 text-xs hover:underline dark:text-blue-400"
							>
								Track
							</a>
						)}
					</div>
				) : (
					<span className="text-muted-foreground/50 text-xs">—</span>
				)}
			</td>
			<td className="hidden px-4 py-3 text-muted-foreground text-xs xl:table-cell">
				{formatDate(shipment.createdAt)}
			</td>
			<td className="px-4 py-3 text-right">
				<div className="flex items-center justify-end gap-1">
					{nextStatuses.length > 0 && (
						<select
							onChange={(e) => {
								if (e.target.value)
									onUpdateStatus(shipment.id, e.target.value as ShipmentStatus);
								e.target.value = "";
							}}
							defaultValue=""
							className="h-7 rounded border border-border bg-background px-1.5 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
						>
							<option value="" disabled>
								Update…
							</option>
							{nextStatuses.map((s) => (
								<option key={s} value={s}>
									{STATUS_LABELS[s]}
								</option>
							))}
						</select>
					)}
					{shipment.labelUrl && (
						<a
							href={shipment.labelUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="rounded px-2 py-1 text-blue-600 text-xs hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
						>
							Label
						</a>
					)}
					<button
						type="button"
						onClick={() => onDelete(shipment.id)}
						className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
					>
						Delete
					</button>
				</div>
			</td>
		</tr>
	);
}

export function ShipmentsAdmin() {
	const api = useShipmentsApi();

	const shipmentOrderIdRef = useRef<HTMLInputElement>(null);
	const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "">("");
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState<CreateShipmentForm>(DEFAULT_FORM);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const queryParams = statusFilter ? { status: statusFilter } : undefined;
	const { data: shipmentsData, isLoading: loading } =
		api.listShipments.useQuery(queryParams) as {
			data: { shipments: Shipment[] } | undefined;
			isLoading: boolean;
		};

	const { data: carriersData } = api.listCarriers.useQuery() as {
		data: { carriers: ShippingCarrier[] } | undefined;
		isLoading: boolean;
	};

	const shipments = shipmentsData?.shipments ?? [];
	const carriers = carriersData?.carriers ?? [];

	useEffect(() => {
		if (!showCreate) return;
		shipmentOrderIdRef.current?.focus();
	}, [showCreate]);
	useEffect(() => {
		if (!showCreate) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowCreate(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showCreate]);

	const createMutation = api.createShipment.useMutation({
		onSuccess: () => {
			setShowCreate(false);
			setForm(DEFAULT_FORM);
			void api.listShipments.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create shipment"));
		},
		onSettled: () => setSaving(false),
	});

	const updateStatusMutation = api.updateStatus.useMutation({
		onSettled: () => void api.listShipments.invalidate(),
	});

	const deleteMutation = api.deleteShipment.useMutation({
		onSettled: () => void api.listShipments.invalidate(),
	});

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError("");
		createMutation.mutate({
			orderId: form.orderId,
			...(form.carrierId && { carrierId: form.carrierId }),
			...(form.trackingNumber && {
				trackingNumber: form.trackingNumber,
			}),
			...(form.notes && { notes: form.notes }),
		});
	}

	function handleUpdateStatus(id: string, status: ShipmentStatus) {
		updateStatusMutation.mutate({
			params: { id },
			status,
		});
	}

	function handleDelete(id: string) {
		if (!confirm("Delete this shipment?")) return;
		deleteMutation.mutate({ params: { id } });
	}

	const skeletonRows = Array.from({ length: 4 }).map((_, i) => (
		<tr key={`skeleton-${i}`}>
			{Array.from({ length: 6 }).map((_, j) => (
				<td key={`skeleton-cell-${j}`} className="px-4 py-3">
					<div className="h-4 w-20 animate-pulse rounded bg-muted" />
				</td>
			))}
		</tr>
	));

	return (
		<ShipmentsAdminTemplate
			subtitle={`${shipments.length} shipment${shipments.length !== 1 ? "s" : ""}`}
			onAddShipment={() => {
				setForm(DEFAULT_FORM);
				setError("");
				setShowCreate(true);
			}}
			filter={
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) =>
						setStatusFilter(e.target.value as ShipmentStatus | "")
					}
					className="h-9 rounded-md border border-border bg-background px-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All statuses</option>
					{ALL_STATUSES.map((s) => (
						<option key={s} value={s}>
							{STATUS_LABELS[s]}
						</option>
					))}
				</select>
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
										Carrier
									</th>
									<th
										scope="col"
										className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
									>
										Tracking
									</th>
									<th
										scope="col"
										className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide xl:table-cell"
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
									skeletonRows
								) : shipments.length === 0 ? (
									<tr>
										<td colSpan={6} className="px-4 py-12 text-center">
											<p className="font-medium text-foreground text-sm">
												{statusFilter
													? `No ${STATUS_LABELS[statusFilter].toLowerCase()} shipments`
													: "No shipments"}
											</p>
											<p className="mt-1 text-muted-foreground text-xs">
												{statusFilter
													? "Try a different filter or create a new shipment"
													: "Create a shipment to start tracking deliveries"}
											</p>
										</td>
									</tr>
								) : (
									shipments.map((s) => (
										<ShipmentRow
											key={s.id}
											shipment={s}
											carriers={carriers}
											onUpdateStatus={handleUpdateStatus}
											onDelete={handleDelete}
										/>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Create Shipment Modal */}
					{showCreate && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div
								role="dialog"
								aria-modal="true"
								className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
							>
								<h2 className="mb-4 font-semibold text-foreground text-lg">
									Create shipment
								</h2>
								{error && (
									<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
										{error}
									</p>
								)}
								<form onSubmit={handleCreate} className="space-y-4">
									<div>
										<label
											htmlFor="shipment-order-id"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Order ID <span className="text-red-500">*</span>
										</label>
										<input
											ref={shipmentOrderIdRef}
											id="shipment-order-id"
											required
											value={form.orderId}
											onChange={(e) =>
												setForm((f) => ({
													...f,
													orderId: e.target.value,
												}))
											}
											placeholder="Order ID to ship"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="shipment-carrier"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Carrier
										</label>
										<select
											id="shipment-carrier"
											value={form.carrierId}
											onChange={(e) =>
												setForm((f) => ({
													...f,
													carrierId: e.target.value,
												}))
											}
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										>
											<option value="">Select carrier…</option>
											{carriers.map((c) => (
												<option key={c.id} value={c.id}>
													{c.name}
												</option>
											))}
										</select>
									</div>
									<div>
										<label
											htmlFor="shipment-tracking"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Tracking number
										</label>
										<input
											id="shipment-tracking"
											value={form.trackingNumber}
											onChange={(e) =>
												setForm((f) => ({
													...f,
													trackingNumber: e.target.value,
												}))
											}
											placeholder="Optional tracking number"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="shipment-notes"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Notes
										</label>
										<textarea
											id="shipment-notes"
											value={form.notes}
											onChange={(e) =>
												setForm((f) => ({
													...f,
													notes: e.target.value,
												}))
											}
											rows={2}
											placeholder="Optional internal notes"
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
											{saving ? "Creating…" : "Create shipment"}
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
