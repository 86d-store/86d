"use client";

import { useState } from "react";
import { type Currency, useCurrencyApi } from "./_shared";

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export function CurrencyForm({ params }: { params?: { id?: string } } = {}) {
	const api = useCurrencyApi();
	const isEdit = Boolean(params?.id);
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const [symbol, setSymbol] = useState("");
	const [decimalPlaces, setDecimalPlaces] = useState(2);
	const [exchangeRate, setExchangeRate] = useState(1);
	const [isActive, setIsActive] = useState(true);
	const [symbolPosition, setSymbolPosition] = useState("before");
	const [roundingMode, setRoundingMode] = useState("round");
	const [initialized, setInitialized] = useState(false);
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);

	const { data: currencyData, isLoading } = api.getCurrency.useQuery(
		{ params: { id: params?.id ?? "" } },
		{ enabled: isEdit },
	) as {
		data: { currency?: Currency } | undefined;
		isLoading: boolean;
	};

	const currency = currencyData?.currency;

	if (currency && !initialized) {
		setCode(currency.code);
		setName(currency.name);
		setSymbol(currency.symbol);
		setDecimalPlaces(currency.decimalPlaces);
		setExchangeRate(currency.exchangeRate);
		setIsActive(currency.isActive);
		setSymbolPosition(currency.symbolPosition);
		setRoundingMode(currency.roundingMode);
		setInitialized(true);
	}

	const createMutation = api.createCurrency.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const updateMutation = api.updateCurrency.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSaved(false);

		if (!code.trim() || !name.trim() || !symbol.trim()) {
			setError("Code, name, and symbol are required.");
			return;
		}

		try {
			if (isEdit && params?.id) {
				await updateMutation.mutateAsync({
					params: { id: params.id },
					body: {
						name: name.trim(),
						symbol: symbol.trim(),
						decimalPlaces,
						exchangeRate,
						isActive,
						symbolPosition,
						roundingMode,
					},
				});
				setSaved(true);
			} else {
				await createMutation.mutateAsync({
					body: {
						code: code.trim().toUpperCase(),
						name: name.trim(),
						symbol: symbol.trim(),
						decimalPlaces,
						exchangeRate,
						isActive,
						symbolPosition,
						roundingMode,
					},
				});
				window.location.href = "/admin/currencies";
			}
		} catch (err) {
			setError(extractError(err));
		}
	};

	if (isEdit && isLoading) {
		return (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
				<div className="h-64 animate-pulse rounded-lg border border-border bg-muted/30" />
			</div>
		);
	}

	if (isEdit && !currency && !isLoading) {
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
				<h1 className="mt-2 font-bold text-2xl text-foreground">
					{isEdit ? "Edit Currency" : "Add Currency"}
				</h1>
			</div>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}
			{saved ? (
				<div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 text-sm dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
					Currency saved successfully.
				</div>
			) : null}

			<form
				onSubmit={handleSubmit}
				className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-5"
			>
				<div className="grid gap-4 sm:grid-cols-3">
					<label className="block">
						<span className="mb-1 block font-medium text-sm">
							Code (ISO 4217)
						</span>
						<input
							type="text"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="USD"
							maxLength={3}
							disabled={isEdit}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase disabled:opacity-50"
						/>
					</label>
					<label className="block">
						<span className="mb-1 block font-medium text-sm">Name</span>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="US Dollar"
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
					<label className="block">
						<span className="mb-1 block font-medium text-sm">Symbol</span>
						<input
							type="text"
							value={symbol}
							onChange={(e) => setSymbol(e.target.value)}
							placeholder="$"
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
				</div>

				<div className="grid gap-4 sm:grid-cols-3">
					<label className="block">
						<span className="mb-1 block font-medium text-sm">
							Decimal Places
						</span>
						<input
							type="number"
							value={decimalPlaces}
							onChange={(e) =>
								setDecimalPlaces(Number.parseInt(e.target.value, 10) || 0)
							}
							min={0}
							max={8}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
					<label className="block">
						<span className="mb-1 block font-medium text-sm">
							Exchange Rate
						</span>
						<input
							type="number"
							value={exchangeRate}
							onChange={(e) =>
								setExchangeRate(Number.parseFloat(e.target.value) || 0)
							}
							step="0.000001"
							min={0}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
					<label className="block">
						<span className="mb-1 block font-medium text-sm">
							Symbol Position
						</span>
						<select
							value={symbolPosition}
							onChange={(e) => setSymbolPosition(e.target.value)}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						>
							<option value="before">Before ($100)</option>
							<option value="after">After (100$)</option>
						</select>
					</label>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<label className="block">
						<span className="mb-1 block font-medium text-sm">
							Rounding Mode
						</span>
						<select
							value={roundingMode}
							onChange={(e) => setRoundingMode(e.target.value)}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						>
							<option value="round">Round</option>
							<option value="ceil">Ceil</option>
							<option value="floor">Floor</option>
						</select>
					</label>
					<label className="flex items-center gap-2 self-end pb-2">
						<input
							type="checkbox"
							checked={isActive}
							onChange={(e) => setIsActive(e.target.checked)}
							className="rounded border-border"
						/>
						<span className="font-medium text-sm">Active</span>
					</label>
				</div>

				<button
					type="submit"
					disabled={createMutation.isPending || updateMutation.isPending}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
				>
					{createMutation.isPending || updateMutation.isPending
						? "Saving..."
						: isEdit
							? "Save Changes"
							: "Create Currency"}
				</button>
			</form>
		</div>
	);
}
