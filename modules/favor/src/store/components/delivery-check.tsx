"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import DeliveryCheckTemplate from "./delivery-check.mdx";

interface AvailabilityResult {
	available: boolean;
	deliveryFee?: number | undefined;
	estimatedMinutes?: number | undefined;
	minOrderAmount?: number | undefined;
}

function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

export interface DeliveryCheckProps {
	currency?: string;
}

export function DeliveryCheck({ currency = "USD" }: DeliveryCheckProps) {
	const client = useModuleClient();
	const api = client.module("favor").store["/favor/availability"];

	const [input, setInput] = useState("");
	const [submitted, setSubmitted] = useState<string | null>(null);

	const query = api.useQuery(
		{ zipCode: submitted ?? "" },
		{ enabled: Boolean(submitted) },
	) as {
		data: (AvailabilityResult & { error?: string }) | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	function handleCheck(e: React.FormEvent) {
		e.preventDefault();
		if (input.trim()) setSubmitted(input.trim());
	}

	const result =
		query.data && !query.data.error ? (query.data as AvailabilityResult) : null;
	const error = query.error?.message ?? query.data?.error ?? null;

	return (
		<DeliveryCheckTemplate
			zipCode={input}
			onZipCodeChange={setInput}
			onCheck={handleCheck}
			isChecking={query.isLoading}
			result={result}
			error={error}
			currency={currency}
			formatCurrency={formatCurrency}
		/>
	);
}
