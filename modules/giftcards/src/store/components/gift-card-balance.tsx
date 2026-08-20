"use client";

import { useState } from "react";
import { useGiftCardApi } from "./_hooks";
import { extractError, formatCurrency } from "./_utils";
import GiftCardBalanceTemplate from "./gift-card-balance.mdx";

/**
 * Balance Checker — customer enters code to check balance
 */
export function GiftCardBalance() {
	const api = useGiftCardApi();
	const [code, setCode] = useState("");
	const [result, setResult] = useState<{
		balance: number;
		currency: string;
		status: string;
	} | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleCheck = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!code.trim()) return;

		setError("");
		setResult(null);
		setLoading(true);

		try {
			const res = await api.check.fetch({ code: code.trim().toUpperCase() });
			const data = res as Record<string, unknown>;
			if (data?.error) {
				setError(String(data.error));
			} else {
				setResult({
					balance: data.balance as number,
					currency: data.currency as string,
					status: data.status as string,
				});
			}
		} catch (err) {
			setError(
				extractError(
					err instanceof Error ? err : null,
					"Failed to check gift card.",
				),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<GiftCardBalanceTemplate
			code={code}
			onCodeChange={setCode}
			onSubmit={handleCheck}
			result={result}
			error={error}
			loading={loading}
			formatCurrency={formatCurrency}
		/>
	);
}
