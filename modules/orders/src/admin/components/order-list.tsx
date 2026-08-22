"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useState } from "react";
import OrderListTemplate from "./order-list.mdx";

interface Order {
	id: string;
	orderNumber: string;
	customerId?: string | null;
	guestEmail?: string | null;
	status: string;
	paymentStatus: string;
	total: number;
	currency: string;
	createdAt: string;
}

interface OrderItem {
	name: string;
	sku?: string | null;
	price: number;
	quantity: number;
	subtotal: number;
}

interface OrderAddress {
	type: "billing" | "shipping";
	firstName: string;
	lastName: string;
	company?: string | null;
	line1: string;
	line2?: string | null;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string | null;
}

interface OrderWithDetails extends Order {
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	items: OrderItem[];
	addresses: OrderAddress[];
}

interface ListResult {
	orders: Order[];
	total: number;
	pages: number;
}

interface ExportResult {
	orders: OrderWithDetails[];
	total: number;
}

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	on_hold:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-muted text-muted-foreground",
	refunded: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const PAYMENT_COLORS: Record<string, string> = {
	unpaid: "text-red-700 dark:text-red-400",
	paid: "text-green-700 dark:text-green-400",
	partially_paid: "text-amber-700 dark:text-amber-400",
	refunded: "text-muted-foreground",
	voided: "text-muted-foreground",
};

function useOrdersAdminApi() {
	const client = useModuleClient();
	return {
		listOrders: client.module("orders").admin["/admin/orders"],
		exportOrders: client.module("orders").admin["/admin/orders/export"],
		bulkAction: client.module("orders").admin["/admin/orders/bulk"],
	};
}

function escapeCsvField(value: string): string {
	if (value.includes(",") || value.includes('"') || value.includes("\n")) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function downloadCsv(filename: string, rows: string[][]): void {
	const csv = rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

const CSV_HEADERS = [
	"Order Number",
	"Date",
	"Customer Email",
	"Status",
	"Payment Status",
	"Subtotal",
	"Tax",
	"Shipping",
	"Discount",
	"Total",
	"Currency",
	"Item Count",
	"Line Items",
	"Shipping Name",
	"Shipping Address",
	"Shipping City",
	"Shipping State",
	"Shipping Postal Code",
	"Shipping Country",
	"Notes",
];

function formatOrderRow(o: OrderWithDetails): string[] {
	const shippingAddr = o.addresses.find((a) => a.type === "shipping");
	const lineItems = o.items.map((i) => `${i.name} x${i.quantity}`).join("; ");

	return [
		o.orderNumber,
		new Date(o.createdAt).toISOString(),
		o.guestEmail ?? o.customerId ?? "",
		o.status,
		o.paymentStatus,
		(o.subtotal / 100).toFixed(2),
		(o.taxAmount / 100).toFixed(2),
		(o.shippingAmount / 100).toFixed(2),
		(o.discountAmount / 100).toFixed(2),
		(o.total / 100).toFixed(2),
		o.currency,
		String(o.items.length),
		lineItems,
		shippingAddr ? `${shippingAddr.firstName} ${shippingAddr.lastName}` : "",
		shippingAddr
			? [shippingAddr.line1, shippingAddr.line2].filter(Boolean).join(", ")
			: "",
		shippingAddr?.city ?? "",
		shippingAddr?.state ?? "",
		shippingAddr?.postalCode ?? "",
		shippingAddr?.country ?? "",
		(o as Order & { notes?: string }).notes ?? "",
	];
}

const PAGE_SIZE = 20;

export function OrderList() {
	const api = useOrdersAdminApi();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [exporting, setExporting] = useState(false);
	const [showExportPanel, setShowExportPanel] = useState(false);
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkProcessing, setBulkProcessing] = useState(false);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(PAGE_SIZE),
	};
	if (search) queryInput.search = search;
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: ordersError,
		refetch: refetchOrders,
	} = api.listOrders.useQuery(queryInput) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const bulkMutation = api.bulkAction.useMutation({
		onSettled: () => {
			setBulkProcessing(false);
			setSelected(new Set());
			void api.listOrders.invalidate();
		},
	});

	const orders = listData?.orders ?? [];
	const total = listData?.total ?? 0;
	const totalPages = listData?.pages ?? 1;
	const allOnPageSelected =
		orders.length > 0 && orders.every((o) => selected.has(o.id));

	const toggleSelect = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (allOnPageSelected) {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const o of orders) next.delete(o.id);
				return next;
			});
		} else {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const o of orders) next.add(o.id);
				return next;
			});
		}
	};

	const handleBulkStatus = (status: string) => {
		if (selected.size === 0) return;
		setBulkProcessing(true);
		bulkMutation.mutate({
			action: "updateStatus",
			ids: Array.from(selected),
			status,
		});
	};

	const handleBulkPaymentStatus = (paymentStatus: string) => {
		if (selected.size === 0) return;
		setBulkProcessing(true);
		bulkMutation.mutate({
			action: "updatePaymentStatus",
			ids: Array.from(selected),
			paymentStatus,
		});
	};

	const handleBulkDelete = () => {
		if (selected.size === 0) return;
		if (
			!window.confirm(
				`Are you sure you want to delete ${selected.size} ${selected.size === 1 ? "order" : "orders"}? This cannot be undone.`,
			)
		) {
			return;
		}
		setBulkProcessing(true);
		bulkMutation.mutate({
			action: "delete",
			ids: Array.from(selected),
		});
	};

	const handleExport = useCallback(async () => {
		setExporting(true);
		try {
			const exportQuery: Record<string, string> = { limit: "500" };
			if (search) exportQuery.search = search;
			if (statusFilter) exportQuery.status = statusFilter;
			if (dateFrom) exportQuery.dateFrom = new Date(dateFrom).toISOString();
			if (dateTo) {
				const end = new Date(dateTo);
				end.setHours(23, 59, 59, 999);
				exportQuery.dateTo = end.toISOString();
			}

			const result = (await api.exportOrders.fetch(exportQuery)) as
				| ExportResult
				| undefined;
			const exportOrders = result?.orders ?? [];

			if (exportOrders.length === 0) return;

			const dataRows = exportOrders.map(formatOrderRow);
			const dateStr = new Date().toISOString().slice(0, 10);
			downloadCsv(`orders-${dateStr}.csv`, [CSV_HEADERS, ...dataRows]);
			setShowExportPanel(false);
		} finally {
			setExporting(false);
		}
	}, [api.exportOrders, search, statusFilter, dateFrom, dateTo]);

	if (ordersError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load orders</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchOrders()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const content = (
		<div>
			<div className="mb-6 flex items-start justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Orders</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						{total} {total === 1 ? "order" : "orders"}
					</p>
				</div>
				<button
					type="button"
					disabled={total === 0}
					onClick={() => setShowExportPanel((v) => !v)}
					className="flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" x2="12" y1="15" y2="3" />
					</svg>
					Export CSV
				</button>
			</div>

			{showExportPanel && (
				<div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-foreground text-sm">
							Export Orders
						</h2>
						<button
							type="button"
							onClick={() => setShowExportPanel(false)}
							className="text-muted-foreground hover:text-foreground"
							aria-label="Close export panel"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<line x1="18" x2="6" y1="6" y2="18" />
								<line x1="6" x2="18" y1="6" y2="18" />
							</svg>
						</button>
					</div>
					<p className="mb-3 text-muted-foreground text-xs">
						Export includes line items, shipping addresses, and amount
						breakdown. Up to 500 orders per export.
					</p>
					<div className="flex flex-wrap items-end gap-3">
						<div>
							<label
								htmlFor="export-date-from"
								className="mb-1 block text-muted-foreground text-xs"
							>
								From
							</label>
							<input
								id="export-date-from"
								type="date"
								value={dateFrom}
								onChange={(e) => setDateFrom(e.target.value)}
								className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div>
							<label
								htmlFor="export-date-to"
								className="mb-1 block text-muted-foreground text-xs"
							>
								To
							</label>
							<input
								id="export-date-to"
								type="date"
								value={dateTo}
								onChange={(e) => setDateTo(e.target.value)}
								className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<button
							type="button"
							disabled={exporting}
							onClick={() => void handleExport()}
							className="flex h-9 items-center gap-2 rounded-md bg-foreground px-4 font-medium text-background text-sm transition-colors hover:bg-foreground/90 disabled:opacity-50"
						>
							{exporting ? "Exporting..." : "Download CSV"}
						</button>
						{dateFrom || dateTo ? (
							<button
								type="button"
								onClick={() => {
									setDateFrom("");
									setDateTo("");
								}}
								className="h-9 text-muted-foreground text-xs hover:text-foreground"
							>
								Clear dates
							</button>
						) : null}
					</div>
				</div>
			)}

			<div className="mb-4 flex flex-wrap gap-3">
				<input
					type="search"
					placeholder="Search by order number or email..."
					aria-label="Search orders"
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
				<select
					value={statusFilter}
					onChange={(e) => {
						setStatusFilter(e.target.value);
						setPage(1);
					}}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					aria-label="Filter by status"
				>
					<option value="">All statuses</option>
					<option value="pending">Pending</option>
					<option value="processing">Processing</option>
					<option value="on_hold">On Hold</option>
					<option value="completed">Completed</option>
					<option value="cancelled">Cancelled</option>
					<option value="refunded">Refunded</option>
				</select>
			</div>

			{/* Bulk Action Bar */}
			{selected.size > 0 && (
				<div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
					<span className="font-medium text-foreground text-sm">
						{selected.size} {selected.size === 1 ? "order" : "orders"} selected
					</span>
					<div className="ml-auto flex flex-wrap items-center gap-2">
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={() => handleBulkStatus("processing")}
							className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							Mark Processing
						</button>
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={() => handleBulkStatus("completed")}
							className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							Mark Completed
						</button>
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={() => handleBulkPaymentStatus("paid")}
							className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
						>
							Mark Paid
						</button>
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={() => handleBulkStatus("cancelled")}
							className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={handleBulkDelete}
							className="rounded-md bg-destructive px-3 py-1.5 font-medium text-destructive-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{bulkProcessing ? "Processing..." : "Delete"}
						</button>
						<button
							type="button"
							onClick={() => setSelected(new Set())}
							className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
						>
							Deselect
						</button>
					</div>
				</div>
			)}

			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th scope="col" className="w-10 px-4 py-3">
								<input
									type="checkbox"
									checked={allOnPageSelected}
									onChange={toggleSelectAll}
									disabled={orders.length === 0}
									className="h-4 w-4 rounded border-border text-foreground"
									aria-label="Select all orders on this page"
								/>
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Order
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Customer
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
								Payment
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Total
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Date
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{loading ? (
							(["k0", "k1", "k2", "k3", "k4"] as const).map((_key) => (
								<tr key={rowKey}>
									<td className="px-4 py-3">
										<div className="h-4 w-4 animate-pulse rounded bg-muted" />
									</td>
									{(["k0", "k1", "k2", "k3", "k4", "k5"] as const).map(
										(_key) => (
											<td key={cellKey} className="px-4 py-3">
												<div className="h-4 w-24 animate-pulse rounded bg-muted" />
											</td>
										),
									)}
								</tr>
							))
						) : orders.length === 0 ? (
							<tr>
								<td colSpan={7} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No orders found
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Orders will appear here once customers complete checkout
									</p>
								</td>
							</tr>
						) : (
							orders.map((order) => (
								<tr
									key={order.id}
									className={`cursor-pointer transition-colors hover:bg-muted/30 ${selected.has(order.id) ? "bg-muted/20" : ""}`}
									onClick={() => {
										window.location.href = `/admin/orders/${order.id}`;
									}}
								>
									<td
										className="px-4 py-3"
										onClick={(e) => e.stopPropagation()}
										onKeyDown={(e) => e.stopPropagation()}
									>
										<input
											type="checkbox"
											checked={selected.has(order.id)}
											onChange={() => toggleSelect(order.id)}
											className="h-4 w-4 rounded border-border text-foreground"
											aria-label={`Select order ${order.orderNumber}`}
										/>
									</td>
									<td className="px-4 py-3">
										<span className="font-medium font-mono text-foreground text-sm">
											{order.orderNumber}
										</span>
									</td>
									<td className="hidden px-4 py-3 text-sm sm:table-cell">
										{order.guestEmail ?? (
											<span className="text-muted-foreground">Customer</span>
										)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{order.status.replace(/_/g, " ")}
										</span>
									</td>
									<td className="hidden px-4 py-3 text-sm md:table-cell">
										<span
											className={`font-medium ${PAYMENT_COLORS[order.paymentStatus] ?? ""}`}
										>
											{order.paymentStatus.replace(/_/g, " ")}
										</span>
									</td>
									<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
										{formatPrice(order.total, order.currency)}
									</td>
									<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
										{timeAgo(order.createdAt)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="mt-4 flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page === 1}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						Previous
					</button>
					<span className="text-muted-foreground text-sm">
						Page {page} of {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page === totalPages}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);

	return <OrderListTemplate content={content} />;
}
