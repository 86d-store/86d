"use client";

import { useState } from "react";
import { useTippingStoreApi } from "./_hooks";
import TipSelectorTemplate from "./tip-selector.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface TipSettings {
	presetPercents: number[];
	allowCustom: boolean;
	maxPercent: number;
	maxAmount: number;
}

interface Tip {
	id: string;
	orderId: string;
	amount: number;
	percentage?: number | undefined;
	type: "preset" | "custom";
	status: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

function extractError(err: unknown, fallback = "Something went wrong"): string {
	const e = err as { body?: { error?: string }; message?: string } | null;
	if (typeof e?.body?.error === "string") return e.body.error;
	if (typeof e?.message === "string") return e.message;
	return fallback;
}

// ── TipSelector ──────────────────────────────────────────────────────────────

export interface TipSelectorProps {
	/** The order ID to attach the tip to */
	orderId: string;
	/** Order subtotal in smallest currency unit (cents) */
	orderTotal: number;
	/** ISO 4217 currency code (default: "USD") */
	currency?: string;
}

export function TipSelector({
	orderId,
	orderTotal,
	currency = "USD",
}: TipSelectorProps) {
	const api = useTippingStoreApi();

	const [customAmount, setCustomAmount] = useState("");
	const [error, setError] = useState<string | null>(null);

	const settingsQuery = api.getSettings.useQuery({}) as {
		data: TipSettings | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const tipsQuery = api.getOrderTips.useQuery(
		{ params: { orderId } },
		{ enabled: Boolean(orderId) },
	) as {
		data: { tips?: Tip[]; total?: number } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const addMutation = api.addTip.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};

	const removeMutation = api.removeTip.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const settings = settingsQuery.data;
	const existingTips = tipsQuery.data?.tips ?? [];
	const currentTip = existingTips[0] ?? null;
	const tipTotal = tipsQuery.data?.total ?? 0;

	if (settingsQuery.isError) return null;

	const isLoading = settingsQuery.isLoading || tipsQuery.isLoading;
	const isMutating = addMutation.isPending || removeMutation.isPending;

	const presets = settings?.presetPercents ?? [15, 18, 20, 25];
	const maxPercent = settings?.maxPercent ?? 100;
	const allowCustom = settings?.allowCustom ?? true;

	async function handlePreset(percent: number) {
		setError(null);
		const amount = Math.round((orderTotal * percent) / 100);

		try {
			if (currentTip) {
				await removeMutation.mutateAsync({ params: { id: currentTip.id } });
			}
			await addMutation.mutateAsync({
				body: { orderId, amount, percentage: percent, type: "preset" },
			});
			tipsQuery.refetch();
		} catch (err) {
			setError(extractError(err, "Failed to add tip."));
		}
	}

	async function handleCustom(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		const dollars = Number.parseFloat(customAmount);
		if (Number.isNaN(dollars) || dollars < 0) {
			setError("Enter a valid tip amount.");
			return;
		}

		const amount = Math.round(dollars * 100);
		const maxAmount = settings?.maxAmount ?? 100000;

		if (amount > maxAmount) {
			setError(`Maximum tip is ${formatCurrency(maxAmount, currency)}.`);
			return;
		}

		const percent = orderTotal > 0 ? (amount / orderTotal) * 100 : 0;
		if (percent > maxPercent) {
			setError(`Tip cannot exceed ${maxPercent}% of the order total.`);
			return;
		}

		try {
			if (currentTip) {
				await removeMutation.mutateAsync({ params: { id: currentTip.id } });
			}
			await addMutation.mutateAsync({
				body: { orderId, amount, type: "custom" },
			});
			setCustomAmount("");
			tipsQuery.refetch();
		} catch (err) {
			setError(extractError(err, "Failed to add tip."));
		}
	}

	async function handleRemove() {
		if (!currentTip) return;
		setError(null);
		try {
			await removeMutation.mutateAsync({ params: { id: currentTip.id } });
			tipsQuery.refetch();
		} catch (err) {
			setError(extractError(err, "Failed to remove tip."));
		}
	}

	return (
		<TipSelectorTemplate
			isLoading={isLoading}
			isMutating={isMutating}
			error={error}
			presets={presets}
			allowCustom={allowCustom}
			currency={currency}
			orderTotal={orderTotal}
			currentTip={currentTip}
			tipTotal={tipTotal}
			customAmount={customAmount}
			onCustomAmountChange={setCustomAmount}
			onPreset={handlePreset}
			onCustomSubmit={handleCustom}
			onRemove={handleRemove}
			formatCurrency={formatCurrency}
		/>
	);
}
