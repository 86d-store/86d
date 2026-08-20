"use client";

import { useState } from "react";
import { formatDate } from "./_utils";
import ReviewCardTemplate from "./review-card.mdx";
import { StarDisplay } from "./star-display";

interface Review {
	id: string;
	authorName: string;
	rating: number;
	title?: string | undefined;
	body: string;
	isVerifiedPurchase: boolean;
	helpfulCount: number;
	merchantResponse?: string | undefined;
	merchantResponseAt?: string | undefined;
	createdAt: string;
}

export function ReviewCard({
	review,
	onMarkHelpful,
}: {
	review: Review;
	onMarkHelpful?: ((id: string) => Promise<void>) | undefined;
}) {
	const [voted, setVoted] = useState(false);
	const [localCount, setLocalCount] = useState(review.helpfulCount);
	const [loading, setLoading] = useState(false);

	const handleHelpful = async () => {
		if (voted || loading || !onMarkHelpful) return;
		setLoading(true);
		try {
			await onMarkHelpful(review.id);
			setVoted(true);
			setLocalCount((c) => c + 1);
		} catch {
			// silently ignore
		} finally {
			setLoading(false);
		}
	};

	const helpfulButton = onMarkHelpful ? (
		<button
			type="button"
			disabled={voted || loading}
			onClick={() => void handleHelpful()}
			className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
				voted
					? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
					: "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
			} disabled:opacity-60`}
		>
			<span>{voted ? "✓" : "👍"}</span>
			<span>Helpful{localCount > 0 ? ` (${localCount})` : ""}</span>
		</button>
	) : null;

	const merchantResponseBlock = review.merchantResponse ? (
		<div className="mt-3 rounded-lg border-primary/30 border-l-2 bg-muted/30 py-2 pr-3 pl-3">
			<p className="mb-0.5 font-medium text-foreground text-xs">
				Store Response
			</p>
			<p className="text-muted-foreground text-sm leading-relaxed">
				{review.merchantResponse}
			</p>
			{review.merchantResponseAt && (
				<p className="mt-1 text-muted-foreground/60 text-xs">
					{formatDate(review.merchantResponseAt)}
				</p>
			)}
		</div>
	) : null;

	return (
		<ReviewCardTemplate
			review={review}
			formatDate={formatDate}
			starDisplay={<StarDisplay rating={review.rating} size="sm" />}
			helpfulButton={helpfulButton}
			merchantResponseBlock={merchantResponseBlock}
		/>
	);
}
