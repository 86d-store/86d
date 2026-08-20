"use client";

import { useCallback } from "react";
import { useQuotesApi } from "./_hooks";
import { formatCurrency, formatDate, statusColor, statusLabel } from "./_utils";
import MyQuotesTemplate from "./my-quotes.mdx";

interface Quote {
	id: string;
	status: string;
	customerName: string;
	companyName?: string;
	subtotal: number;
	discount: number;
	total: number;
	createdAt: string;
	expiresAt?: string;
	items?: { id: string }[];
}

function QuoteRow({
	quote,
	onSelect,
}: {
	quote: Quote;
	onSelect: (id: string) => void;
}) {
	const itemCount = quote.items?.length ?? 0;

	return (
		<button
			type="button"
			onClick={() => onSelect(quote.id)}
			className="flex w-full items-center justify-between gap-4 border-border border-b px-4 py-4 text-left transition-colors hover:bg-muted/40"
		>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="font-medium text-foreground text-sm">
						Quote #{quote.id.slice(0, 8)}
					</span>
					<span
						className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${statusColor(quote.status)}`}
					>
						{statusLabel(quote.status)}
					</span>
				</div>
				<p className="mt-0.5 text-muted-foreground text-xs">
					{formatDate(quote.createdAt)}
					{itemCount > 0
						? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}`
						: ""}
				</p>
			</div>
			<span className="shrink-0 font-medium text-foreground text-sm">
				{formatCurrency(quote.total)}
			</span>
		</button>
	);
}

export function MyQuotes({
	onSelectQuote,
}: {
	onSelectQuote?: ((id: string) => void) | undefined;
}) {
	const api = useQuotesApi();

	const { data, isLoading, isError, error } = api.myQuotes.useQuery({}) as {
		data: { quotes: Quote[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		error: Error | null;
	};

	const handleSelect = useCallback(
		(id: string) => {
			if (onSelectQuote) {
				onSelectQuote(id);
			} else {
				const url = new URL(window.location.href);
				url.searchParams.set("quote", id);
				window.location.href = url.toString();
			}
		},
		[onSelectQuote],
	);

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-4 h-7 w-36 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-3">
					{[1, 2, 3].map((n) => (
						<div key={n} className="h-16 animate-pulse rounded-lg bg-muted" />
					))}
				</div>
			</section>
		);
	}

	if (isError) {
		const is401 = (error as Error & { status?: number }).status === 401;
		return (
			<section className="py-8">
				<h2 className="mb-4 font-semibold text-foreground text-xl">
					My Quotes
				</h2>
				<div className="rounded-xl border border-border bg-muted/30 py-12 text-center">
					<p className="text-muted-foreground text-sm">
						{is401
							? "Please sign in to view your quotes."
							: "Failed to load quotes."}
					</p>
				</div>
			</section>
		);
	}

	const quotes = data?.quotes ?? [];

	const quoteListContent =
		quotes.length === 0 ? null : (
			<div className="overflow-hidden rounded-xl border border-border">
				{quotes.map((quote) => (
					<QuoteRow key={quote.id} quote={quote} onSelect={handleSelect} />
				))}
			</div>
		);

	return (
		<MyQuotesTemplate
			isEmpty={quotes.length === 0}
			quoteListContent={quoteListContent}
		/>
	);
}
