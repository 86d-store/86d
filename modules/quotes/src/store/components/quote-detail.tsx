"use client";

import { useCallback, useState } from "react";
import { useQuotesApi } from "./_hooks";
import {
	extractError,
	formatCurrency,
	formatDate,
	statusColor,
	statusLabel,
} from "./_utils";
import QuoteDetailTemplate from "./quote-detail.mdx";

interface QuoteItem {
	id: string;
	quoteId: string;
	productId: string;
	productName: string;
	sku?: string;
	quantity: number;
	unitPrice: number;
	offeredPrice: number;
	notes?: string;
}

interface QuoteComment {
	id: string;
	quoteId: string;
	authorType: "customer" | "admin";
	authorId: string;
	authorName: string;
	message: string;
	createdAt: string;
}

interface Quote {
	id: string;
	customerId: string;
	customerEmail: string;
	customerName: string;
	companyName?: string;
	status: string;
	notes?: string;
	adminNotes?: string;
	subtotal: number;
	discount: number;
	total: number;
	expiresAt?: string;
	convertedOrderId?: string;
	metadata?: Record<string, unknown>;
	createdAt: string;
	items: QuoteItem[];
	comments: QuoteComment[];
}

function StatusBadge({ status }: { status: string }) {
	return (
		<span
			className={`inline-flex rounded-full px-2.5 py-0.5 font-medium text-xs ${statusColor(status)}`}
		>
			{statusLabel(status)}
		</span>
	);
}

function CommentBubble({ comment }: { comment: QuoteComment }) {
	const isAdmin = comment.authorType === "admin";
	return (
		<div className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
			<div
				className={`max-w-[80%] rounded-xl px-4 py-3 ${
					isAdmin
						? "bg-muted/60 text-foreground"
						: "bg-primary/10 text-foreground"
				}`}
			>
				<div className="mb-1 flex items-center gap-2">
					<span className="font-medium text-xs">{comment.authorName}</span>
					<span className="text-muted-foreground text-xs">
						{formatDate(comment.createdAt)}
					</span>
				</div>
				<p className="text-sm">{comment.message}</p>
			</div>
		</div>
	);
}

export function QuoteDetail(props: {
	quoteId?: string | undefined;
	onBack?: (() => void) | undefined;
	params?: Record<string, string> | undefined;
}) {
	const quoteId = props.quoteId ?? props.params?.id ?? "";
	const { onBack } = props;
	const api = useQuotesApi();
	const [commentText, setCommentText] = useState("");
	const [actionError, setActionError] = useState("");

	const { data, isLoading, isError, error, refetch } = api.getQuote.useQuery({
		params: { id: quoteId },
	}) as {
		data: { quote: Quote } | undefined;
		isLoading: boolean;
		isError: boolean;
		error: Error | null;
		refetch: () => void;
	};

	const acceptMutation = api.acceptQuote.useMutation({
		onSuccess: () => {
			setActionError("");
			refetch();
		},
		onError: (err: Error) => {
			setActionError(extractError(err, "Failed to accept quote."));
		},
	});

	const declineMutation = api.declineQuote.useMutation({
		onSuccess: () => {
			setActionError("");
			refetch();
		},
		onError: (err: Error) => {
			setActionError(extractError(err, "Failed to decline quote."));
		},
	});

	const submitMutation = api.submitQuote.useMutation({
		onSuccess: () => {
			setActionError("");
			refetch();
		},
		onError: (err: Error) => {
			setActionError(extractError(err, "Failed to submit quote."));
		},
	});

	const commentMutation = api.addComment.useMutation({
		onSuccess: () => {
			setCommentText("");
			refetch();
		},
		onError: (err: Error) => {
			setActionError(extractError(err, "Failed to add comment."));
		},
	});

	const handleBack = useCallback(() => {
		if (onBack) {
			onBack();
		} else {
			const url = new URL(window.location.href);
			url.searchParams.delete("quote");
			window.location.href = url.toString();
		}
	}, [onBack]);

	const handleAddComment = (e: React.FormEvent) => {
		e.preventDefault();
		if (!commentText.trim()) return;
		commentMutation.mutate({
			params: { id: quoteId },
			message: commentText.trim(),
		});
	};

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-4 h-5 w-20 animate-pulse rounded bg-muted" />
				<div className="mb-6 h-7 w-48 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-3">
					{[1, 2, 3].map((n) => (
						<div key={n} className="h-14 animate-pulse rounded-lg bg-muted" />
					))}
				</div>
			</section>
		);
	}

	if (isError || !data?.quote) {
		const status = (error as Error & { status?: number }).status;
		const message =
			status === 401
				? "Please sign in to view this quote."
				: status === 404
					? "Quote not found."
					: "Failed to load quote.";
		return (
			<section className="py-8">
				<button
					type="button"
					onClick={handleBack}
					className="mb-4 text-primary text-sm underline-offset-4 hover:underline"
				>
					&larr; Back to quotes
				</button>
				<div className="rounded-xl border border-border bg-muted/30 py-12 text-center">
					<p className="text-muted-foreground text-sm">{message}</p>
				</div>
			</section>
		);
	}

	const quote = data.quote;
	const items = quote.items ?? [];
	const comments = quote.comments ?? [];

	const canSubmit = quote.status === "draft";
	const canAcceptDecline = quote.status === "countered";
	const canComment = !["rejected", "expired", "converted"].includes(
		quote.status,
	);

	const statusBadge = <StatusBadge status={quote.status} />;

	const itemsContent = (
		<div className="mb-6 overflow-hidden rounded-xl border border-border">
			<div className="border-border border-b bg-muted/40 px-4 py-2.5">
				<h3 className="font-medium text-foreground text-sm">Line Items</h3>
			</div>
			{items.length === 0 ? (
				<div className="px-4 py-6 text-center text-muted-foreground text-sm">
					No items added yet.
				</div>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/20">
								<th
									scope="col"
									className="px-4 py-2 text-left font-medium text-muted-foreground"
								>
									Product
								</th>
								<th
									scope="col"
									className="px-4 py-2 text-right font-medium text-muted-foreground"
								>
									Qty
								</th>
								<th
									scope="col"
									className="px-4 py-2 text-right font-medium text-muted-foreground"
								>
									Unit Price
								</th>
								<th
									scope="col"
									className="px-4 py-2 text-right font-medium text-muted-foreground"
								>
									Offered Price
								</th>
								<th
									scope="col"
									className="px-4 py-2 text-right font-medium text-muted-foreground"
								>
									Subtotal
								</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item) => (
								<tr
									key={item.id}
									className="border-border border-b last:border-0"
								>
									<td className="px-4 py-3">
										<p className="font-medium text-foreground">
											{item.productName}
										</p>
										{item.sku && (
											<p className="text-muted-foreground text-xs">
												SKU: {item.sku}
											</p>
										)}
										{item.notes && (
											<p className="mt-0.5 text-muted-foreground text-xs italic">
												{item.notes}
											</p>
										)}
									</td>
									<td className="px-4 py-3 text-right text-foreground">
										{item.quantity}
									</td>
									<td className="px-4 py-3 text-right text-muted-foreground">
										{formatCurrency(item.unitPrice)}
									</td>
									<td className="px-4 py-3 text-right text-foreground">
										{formatCurrency(item.offeredPrice)}
									</td>
									<td className="px-4 py-3 text-right font-medium text-foreground">
										{formatCurrency(item.offeredPrice * item.quantity)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);

	const totalsContent = (
		<div className="mb-6 rounded-xl border border-border p-4">
			<div className="space-y-1.5 text-sm">
				<div className="flex justify-between">
					<span className="text-muted-foreground">Subtotal</span>
					<span className="text-foreground">
						{formatCurrency(quote.subtotal)}
					</span>
				</div>
				{quote.discount > 0 && (
					<div className="flex justify-between">
						<span className="text-muted-foreground">Discount</span>
						<span className="text-emerald-600 dark:text-emerald-400">
							-{formatCurrency(quote.discount)}
						</span>
					</div>
				)}
				<div className="flex justify-between border-border border-t pt-1.5 font-medium">
					<span className="text-foreground">Total</span>
					<span className="text-foreground">{formatCurrency(quote.total)}</span>
				</div>
			</div>
		</div>
	);

	const commentsContent = (
		<div className="mb-6">
			<h3 className="mb-3 font-medium text-foreground text-sm">Comments</h3>
			{comments.length === 0 ? (
				<p className="text-muted-foreground text-sm">No comments yet.</p>
			) : (
				<div className="space-y-3">
					{comments.map((comment) => (
						<CommentBubble key={comment.id} comment={comment} />
					))}
				</div>
			)}
		</div>
	);

	const replyForm = canComment ? (
		<form onSubmit={handleAddComment} className="flex gap-2">
			<input
				type="text"
				value={commentText}
				onChange={(e) => setCommentText(e.target.value)}
				placeholder="Add a comment..."
				maxLength={2000}
				className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
			/>
			<button
				type="submit"
				disabled={commentMutation.isPending || !commentText.trim()}
				className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity disabled:opacity-60"
			>
				{commentMutation.isPending ? "Sending..." : "Send"}
			</button>
		</form>
	) : null;

	const actionsContent = (
		<div className="flex flex-wrap gap-2">
			{canSubmit && (
				<button
					type="button"
					disabled={submitMutation.isPending}
					onClick={() => submitMutation.mutate({ params: { id: quoteId } })}
					className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity disabled:opacity-60"
				>
					{submitMutation.isPending ? "Submitting..." : "Submit Quote"}
				</button>
			)}
			{canAcceptDecline && (
				<>
					<button
						type="button"
						disabled={acceptMutation.isPending}
						onClick={() => acceptMutation.mutate({ params: { id: quoteId } })}
						className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 font-medium text-emerald-700 text-sm transition-opacity hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
					>
						{acceptMutation.isPending ? "Accepting..." : "Accept Quote"}
					</button>
					<button
						type="button"
						disabled={declineMutation.isPending}
						onClick={() => declineMutation.mutate({ params: { id: quoteId } })}
						className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-700 text-sm transition-opacity hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
					>
						{declineMutation.isPending ? "Declining..." : "Decline Quote"}
					</button>
				</>
			)}
		</div>
	);

	return (
		<QuoteDetailTemplate
			onBack={handleBack}
			quoteNumber={quote.id.slice(0, 8)}
			date={formatDate(quote.createdAt)}
			expiresAt={quote.expiresAt ? formatDate(quote.expiresAt) : null}
			statusBadge={statusBadge}
			customerName={quote.customerName}
			companyName={quote.companyName ?? null}
			notes={quote.notes ?? null}
			convertedOrderId={quote.convertedOrderId ?? null}
			itemsContent={itemsContent}
			totalsContent={totalsContent}
			commentsContent={commentsContent}
			replyForm={replyForm}
			actionsContent={actionsContent}
			actionError={actionError || null}
		/>
	);
}
