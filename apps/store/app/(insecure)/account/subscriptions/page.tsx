"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { CircleCheckIcon } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "~/components/status-badge";
import { Button } from "~/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

interface Subscription {
	id: string;
	planId: string;
	planName?: string | undefined;
	email: string;
	customerId?: string | undefined;
	status: string;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	cancelAtPeriodEnd: boolean;
	cancelledAt?: string | undefined;
	trialEnd?: string | undefined;
	createdAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

// ── Subscriptions Page ──────────────────────────────────────────────────────

export default function SubscriptionsPage() {
	const client = useModuleClient();

	const subsApi = client.module("subscriptions").store["/subscriptions/me"];
	const cancelApi =
		client.module("subscriptions").store["/subscriptions/me/cancel"];

	const {
		data: subsData,
		isLoading,
		isError,
		refetch,
	} = subsApi.useQuery() as {
		data: { subscriptions: Subscription[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const [cancellingId, setCancellingId] = useState<string | null>(null);
	const [error, setError] = useState("");

	const subscriptions = subsData?.subscriptions ?? [];

	async function handleCancel(id: string, atPeriodEnd: boolean) {
		setCancellingId(id);
		setError("");
		try {
			await cancelApi.fetch({
				method: "POST",
				body: { id, cancelAtPeriodEnd: atPeriodEnd },
			});
			refetch();
		} catch {
			setError("Failed to cancel subscription. Please try again.");
		} finally {
			setCancellingId(null);
		}
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="font-bold font-display text-foreground text-xl tracking-tight sm:text-2xl">
					My Subscriptions
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your active subscriptions.
				</p>
			</div>

			{error && (
				<div
					className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					{error}
				</div>
			)}

			{isError ? (
				<div
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					<p>Failed to load your subscriptions.</p>
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
					{[1, 2].map((n) => (
						<Skeleton key={n} className="h-28 rounded-xl" />
					))}
				</div>
			) : subscriptions.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CircleCheckIcon />
						</EmptyMedia>
						<EmptyTitle>No subscriptions</EmptyTitle>
						<EmptyDescription>
							You don&apos;t have any active subscriptions.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="flex flex-col gap-3">
					{subscriptions.map((sub) => {
						const isActive = ["active", "trialing"].includes(sub.status);

						return (
							<div key={sub.id} className="rounded-xl border border-border p-4">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<div className="mb-1 flex items-center gap-2">
											<p className="font-medium text-foreground text-sm">
												{sub.planName ?? sub.planId}
											</p>
											<StatusBadge status={sub.status} />
										</div>
										<div className="flex flex-col gap-0.5 text-muted-foreground text-xs">
											<p>
												Current period: {formatDate(sub.currentPeriodStart)}{" "}
												&ndash; {formatDate(sub.currentPeriodEnd)}
											</p>
											{sub.trialEnd && (
												<p>Trial ends {formatDate(sub.trialEnd)}</p>
											)}
											{sub.cancelAtPeriodEnd && (
												<p className="font-medium text-status-warning">
													Cancels at end of period
												</p>
											)}
											{sub.cancelledAt && (
												<p>Cancelled {formatDate(sub.cancelledAt)}</p>
											)}
											<p>Started {formatDate(sub.createdAt)}</p>
										</div>
									</div>
									{isActive && !sub.cancelAtPeriodEnd && (
										<div className="flex shrink-0 flex-col gap-2">
											<button
												type="button"
												disabled={cancellingId === sub.id}
												onClick={() => handleCancel(sub.id, true)}
												className="rounded-lg border border-border px-3 py-1.5 text-foreground text-xs transition-colors hover:bg-muted disabled:opacity-60"
											>
												Cancel at period end
											</button>
											<Button
												variant="destructive"
												size="xs"
												disabled={cancellingId === sub.id}
												onClick={() => handleCancel(sub.id, false)}
											>
												Cancel now
											</Button>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
