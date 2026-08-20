"use client";

import { useCallback, useState } from "react";
import { useDiscountsApi } from "./_hooks";
import { extractError, formatCents } from "./_utils";
import DiscountCodeInputTemplate from "./discount-code-input.mdx";

interface ValidateResponse {
	valid: boolean;
	discountAmount: number;
	freeShipping: boolean;
	error?: string;
}

export function DiscountCodeInput({
	subtotal = 0,
	productIds,
	categoryIds,
	onApplied,
	onRemoved,
	compact = false,
}: {
	subtotal?: number | undefined;
	productIds?: string[] | undefined;
	categoryIds?: string[] | undefined;
	onApplied?: ((result: ValidateResponse) => void) | undefined;
	onRemoved?: (() => void) | undefined;
	compact?: boolean | undefined;
}) {
	const api = useDiscountsApi();
	const [code, setCode] = useState("");
	const [result, setResult] = useState<ValidateResponse | null>(null);
	const [appliedCode, setAppliedCode] = useState("");
	const [error, setError] = useState("");

	const validateMutation = api.validate.useMutation({
		onSuccess: (data: ValidateResponse) => {
			if (data.valid) {
				setResult(data);
				setAppliedCode(code.trim().toUpperCase());
				onApplied?.(data);
			} else {
				setError(data.error ?? "Invalid promo code.");
			}
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to validate code. Please try again."));
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = code.trim();
		if (!trimmed) return;
		setError("");
		setResult(null);
		validateMutation.mutate({
			code: trimmed,
			subtotal,
			...(productIds ? { productIds } : {}),
			...(categoryIds ? { categoryIds } : {}),
		});
	};

	const handleRemove = useCallback(() => {
		setResult(null);
		setAppliedCode("");
		setCode("");
		setError("");
		onRemoved?.();
	}, [onRemoved]);

	return (
		<DiscountCodeInputTemplate
			code={code}
			onCodeChange={setCode}
			onSubmit={handleSubmit}
			onRemove={handleRemove}
			result={result}
			appliedCode={appliedCode}
			error={error}
			isLoading={validateMutation.isPending}
			compact={compact}
			formatCents={formatCents}
		/>
	);
}
