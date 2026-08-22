"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { Undo2Icon } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "~/components/status-badge";
import { buttonVariants } from "~/components/ui/button-variants";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

interface ReturnItemData {
	id: string;
	returnRequestId: string;
	orderItemId: string;
	quantity: number;
	reason?: string | null;
}

interface ReturnWithOrder {
	id: string;
	orderId: string;
	orderNumber: string;
	status: string;
	type: string;
	reason: string;
	customerNotes?: string | null;
	adminNotes?: string | null;
	refundAmount?: number | null;
	trackingNumber?: string | null;
	trackingUrl?: string | null;
	carrier?: string | null;
	createdAt: string;
	items: ReturnItemData[];
}

interface ReturnsListResponse {
	returns: ReturnWithOrder[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

const STATUS_FILTERS = [
	{ label: "All", value: "" },
	{ label: "Requested", value: "requested" },
	{ label: "Approved", value: "approved" },
	{ label: "Shipped back", value: "shipped_back" },
	{ label: "Received", value: "received" },
	{ label: "Refunded", value: "refunded" },
	{ label: "Completed", value: "completed" },
	{ label: "Rejected", value: "rejected" },
] as const;

const RETURN_STATUS_STEPS = [
	"requested",
	"approved",
	"shipped_back",
	"received",
	"refunded",
	"completed",
] as const;

function ReturnTimeline({ status }: { status: string }) {
	const currentIdx = RETURN_STATUS_STEPS.indexOf(
		status as (typeof RETURN_STATUS_STEPS)[number],
	);

	if (status === "rejected") {
		return (
			<div className="flex items-center gap-1.5">
				<div className="flex size-5 items-center justify-center rounded-full bg-status-danger-bg">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="10"
						height="10"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
						className="text-status-danger"
						aria-hidden="true"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</div>
				<span className="font-medium text-status-danger text-xs">
					Return rejected
				</span>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-0.5">
			{RETURN_STATUS_STEPS.map((step, idx) => (
				<div key={step} className="flex items-center gap-0.5">
					<div
						className={`h-1.5 rounded-full transition-colors ${
							idx <= currentIdx
								? "w-4 bg-foreground"
								: "w-4 bg-muted-foreground/20"
						}`}
					/>
				</div>
			))}
		</div>
	);
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
	const client = useModuleClient();
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");

	const returnsApi = client.module("orders").store["/orders/me/returns"];

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: "10",
	};
	if (statusFilter) {
		queryInput.status = statusFilter;
	}

	const { data, isLoading, isError, refetch } = returnsApi.useQuery(
		queryInput,
	) as {
		data: ReturnsListResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const returns = data?.returns ?? [];
	const pages = data?.pages ?? 1;
	const total = data?.total ?? 0;

	return (
		<div>
			{/* Header */}
			<div className="mb-6">
				<h2 className="font-bold font-display text-foreground text-xl tracking-tight sm:text-2xl">
					Returns
				</h2>
				{total > 0 && (
					<p className="mt-1 text-muted-foreground text-sm">
						{total} return request{total !== 1 ? "s" : ""}
					</p>
				)}
			</div>

			{/* Status filter */}
			<div className="scrollbar-none -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1">
				{STATUS_FILTERS.map((f) => (
					<button
						key={f.value}
						type="button"
						onClick={() => {
							setStatusFilter(f.value);
							setPage(1);
						}}
						className={`shrink-0 rounded-full border px-3 py-1.5 font-medium text-xs transition-colors ${
							statusFilter === f.value
								? "border-foreground bg-foreground text-background"
								: "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
						}`}
					>
						{f.label}
					</button>
				))}
			</div>

			{isError ? (
				<div
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					<p>Failed to load your returns.</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-1 font-medium underline"
					>
						Try again
					</button>
				</div>
			) : isLoading ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3].map((n) => (
						<Skeleton key={n} className="h-28 rounded-xl" />
					))}
				</div>
			) : returns.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Undo2Icon />
						</EmptyMedia>
						<EmptyTitle>
							{statusFilter ? "No matching returns" : "No returns yet"}
						</EmptyTitle>
						<EmptyDescription>
							{statusFilter
								? "Try adjusting your filter."
								: "Return requests will appear here when you submit them."}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<a href="/account/orders" className={buttonVariants()}>
							View orders
						</a>
					</EmptyContent>
				</Empty>
			) : (
				<>
					{/* Returns list */}
					<div className="flex flex-col gap-3">
						{returns.map((r) => (
							<a
								key={r.id}
								href={`/account/orders/${r.orderId}`}
								className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted/30"
							>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<StatusBadge status={r.status} />
											<span className="text-muted-foreground text-xs capitalize">
												{r.type.replace(/_/g, " ")}
											</span>
										</div>
										<p className="mt-1.5 font-medium text-foreground text-sm">
											Order{" "}
											<span className="font-semibold">{r.orderNumber}</span>
										</p>
										<p className="mt-0.5 text-muted-foreground text-sm capitalize">
											Reason: {r.reason.replace(/_/g, " ")}
										</p>
									</div>
									<div className="shrink-0 text-right">
										{r.refundAmount != null && (
											<p className="font-medium text-sm text-status-success">
												{formatPrice(r.refundAmount)}
											</p>
										)}
										<p className="text-muted-foreground text-xs">
											{formatDate(r.createdAt)}
										</p>
									</div>
								</div>

								{/* Timeline */}
								<div className="mt-3">
									<ReturnTimeline status={r.status} />
								</div>

								{/* Admin response */}
								{r.adminNotes && (
									<div className="mt-3 rounded-lg bg-muted/40 p-2.5">
										<p className="mb-0.5 text-muted-foreground text-xs">
											Store response
										</p>
										<p className="text-foreground text-sm">{r.adminNotes}</p>
									</div>
								)}

								{/* Tracking info */}
								{r.trackingNumber && (
									<div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											aria-hidden="true"
										>
											<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
											<path d="M3 6h18" />
											<path d="M16 10a4 4 0 0 1-8 0" />
										</svg>
										<span className="font-mono">
											{r.carrier && `${r.carrier}: `}
											{r.trackingNumber}
										</span>
									</div>
								)}

								{/* Items count */}
								{r.items.length > 0 && (
									<p className="mt-2 text-muted-foreground text-xs">
										{r.items.length} item{r.items.length !== 1 ? "s" : ""}
									</p>
								)}
							</a>
						))}
					</div>

					{/* Pagination */}
					{pages > 1 && (
						<div className="mt-6 flex items-center justify-center gap-2">
							<button
								type="button"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
								className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
							>
								Previous
							</button>
							<span className="px-2 text-muted-foreground text-sm">
								Page {page} of {pages}
							</span>
							<button
								type="button"
								disabled={page >= pages}
								onClick={() => setPage((p) => p + 1)}
								className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
							>
								Next
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
