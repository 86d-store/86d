"use client";

import { useState } from "react";
import { useWaitlistApi } from "./_hooks";
import { extractError, formatDate } from "./_utils";
import WaitlistPageTemplate from "./waitlist-page.mdx";

interface WaitlistEntry {
	id: string;
	productId: string;
	productName: string;
	variantLabel?: string;
	email: string;
	status: string;
	createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
	waiting: "Waiting",
	notified: "Back in stock",
	purchased: "Purchased",
	cancelled: "Cancelled",
};

export function WaitlistPage() {
	const api = useWaitlistApi();
	const [error, setError] = useState("");

	const { data, isLoading } = api.myWaitlist.useQuery({
		take: "50",
	}) as {
		data: { entries: WaitlistEntry[] } | undefined;
		isLoading: boolean;
	};

	const entries = data?.entries ?? [];

	const leaveMutation = api.leaveWaitlist.useMutation({
		onSettled: () => {
			void api.myWaitlist.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to leave waitlist."));
		},
	});

	const handleLeave = (productId: string) => {
		setError("");
		leaveMutation.mutate({ productId });
	};

	const content = isLoading ? (
		<div className="divide-y divide-border">
			{Array.from({ length: 3 }).map((_, i) => (
				<div
					key={`skel-${i}`}
					className="flex items-center justify-between px-5 py-3"
				>
					<div className="flex-1 space-y-1.5">
						<div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
						<div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
					</div>
					<div className="h-7 w-20 animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	) : entries.length === 0 ? (
		<p className="py-12 text-center text-muted-foreground text-sm">
			You are not on any waitlists.
		</p>
	) : (
		<div className="divide-y divide-border">
			{entries.map((entry) => (
				<div
					key={entry.id}
					className="flex items-center justify-between px-5 py-3"
				>
					<div>
						<p className="font-medium text-foreground text-sm">
							{entry.productName}
							{entry.variantLabel && (
								<span className="ml-1 text-muted-foreground text-xs">
									({entry.variantLabel})
								</span>
							)}
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							Joined {formatDate(entry.createdAt)} ·{" "}
							{STATUS_LABELS[entry.status] ?? entry.status}
						</p>
					</div>
					{entry.status === "waiting" && (
						<button
							type="button"
							onClick={() => handleLeave(entry.productId)}
							disabled={leaveMutation.isPending}
							className="text-muted-foreground text-xs hover:text-foreground"
						>
							Remove
						</button>
					)}
				</div>
			))}
		</div>
	);

	return <WaitlistPageTemplate content={content} error={error} />;
}
