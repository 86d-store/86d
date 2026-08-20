"use client";

import { type Currency, useCurrencyApi } from "./_shared";

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function CurrencyDetail({ params }: { params: { id: string } }) {
	const api = useCurrencyApi();

	const { data, isLoading } = api.getCurrency.useQuery({
		params: { id: params.id },
	}) as {
		data: { currency?: Currency; error?: string } | undefined;
		isLoading: boolean;
	};

	const currency = data?.currency;

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
				<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
			</div>
		);
	}

	if (!currency) {
		return (
			<div className="rounded-lg border border-border bg-card p-8 text-center">
				<p className="text-muted-foreground text-sm">Currency not found.</p>
				<a
					href="/admin/currencies"
					className="mt-2 inline-block text-sm underline"
				>
					Back to currencies
				</a>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/currencies"
					className="text-muted-foreground text-sm hover:underline"
				>
					&larr; Back to currencies
				</a>
				<div className="mt-2 flex items-center gap-3">
					<h1 className="font-bold text-2xl text-foreground">
						{currency.name} ({currency.code})
					</h1>
					{currency.isBase ? (
						<span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800 text-xs dark:bg-indigo-900/30 dark:text-indigo-400">
							Base Currency
						</span>
					) : null}
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
							currency.isActive
								? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{currency.isActive ? "Active" : "Inactive"}
					</span>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Details
					</h2>
					<dl className="space-y-3 text-sm">
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Symbol</dt>
							<dd className="font-medium text-foreground">{currency.symbol}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Exchange Rate</dt>
							<dd className="font-mono text-foreground">
								{currency.exchangeRate.toFixed(6)}
							</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Decimal Places</dt>
							<dd className="text-foreground">{currency.decimalPlaces}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Symbol Position</dt>
							<dd className="text-foreground">{currency.symbolPosition}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Rounding</dt>
							<dd className="text-foreground">{currency.roundingMode}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Sort Order</dt>
							<dd className="text-foreground">{currency.sortOrder}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Created</dt>
							<dd className="text-foreground">
								{formatDate(currency.createdAt)}
							</dd>
						</div>
					</dl>
				</div>

				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Actions
					</h2>
					<div className="space-y-2">
						<a
							href={`/admin/currencies/${params.id}/edit`}
							className="block rounded-lg border border-border px-4 py-2 text-center text-sm hover:bg-muted"
						>
							Edit Currency
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}
