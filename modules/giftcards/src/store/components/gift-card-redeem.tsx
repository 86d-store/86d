"use client";

import { useState } from "react";
import { useGiftCardApi } from "./_hooks";
import { extractError, formatCurrency } from "./_utils";
import GiftCardRedeemTemplate from "./gift-card-redeem.mdx";

/**
 * Redeem Form — apply gift card to an order at checkout
 */
export function GiftCardRedeem({
	orderId,
	orderTotal,
	onApplied,
}: {
	orderId?: string;
	orderTotal?: number;
	onApplied?: (amountApplied: number, remainingBalance: number) => void;
}) {
	const api = useGiftCardApi();
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [applied, setApplied] = useState<{
		amount: number;
		remaining: number;
		currency: string;
	} | null>(null);

	const redeemMutation = api.redeem.useMutation({
		onError: (err: Error) => {
			setError(extractError(err, "Failed to apply gift card."));
		},
		onSuccess: (data: Record<string, unknown>) => {
			setApplied({
				amount: data.amountApplied as number,
				remaining: data.remainingBalance as number,
				currency: data.currency as string,
			});
			onApplied?.(
				data.amountApplied as number,
				data.remainingBalance as number,
			);
		},
	});

	const handleRedeem = (e: React.FormEvent) => {
		e.preventDefault();
		if (!code.trim()) return;
		setError("");
		setApplied(null);
		redeemMutation.mutate({
			code: code.trim().toUpperCase(),
			amount: orderTotal ?? 0,
			...(orderId ? { orderId } : {}),
		});
	};

	return (
		<GiftCardRedeemTemplate
			code={code}
			onCodeChange={setCode}
			onSubmit={handleRedeem}
			applied={applied}
			error={error}
			isLoading={redeemMutation.isPending}
			formatCurrency={formatCurrency}
		/>
	);
}
