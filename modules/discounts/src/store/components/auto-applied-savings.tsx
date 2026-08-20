"use client";

import { useEffect, useRef, useState } from "react";
import { useDiscountsApi } from "./_hooks";
import { formatCents, formatDiscountValue } from "./_utils";
import AutoAppliedSavingsTemplate from "./auto-applied-savings.mdx";

interface CartRuleResult {
	ruleId: string;
	ruleName: string;
	type: string;
	discountAmount: number;
	freeShipping: boolean;
}

interface EvaluateResponse {
	rules: CartRuleResult[];
	totalDiscount: number;
	freeShipping: boolean;
}

export function AutoAppliedSavings({
	subtotal,
	itemCount,
	productIds,
	categoryIds,
	onEvaluated,
}: {
	subtotal: number;
	itemCount: number;
	productIds?: string[] | undefined;
	categoryIds?: string[] | undefined;
	onEvaluated?: ((result: EvaluateResponse) => void) | undefined;
}) {
	const api = useDiscountsApi();
	const [data, setData] = useState<EvaluateResponse | null>(null);
	const onEvaluatedRef = useRef(onEvaluated);
	onEvaluatedRef.current = onEvaluated;

	const mutation = api.evaluateCartRules.useMutation({
		onSuccess: (result: EvaluateResponse) => {
			setData(result);
			if (result.rules.length > 0) {
				onEvaluatedRef.current?.(result);
			}
		},
	});

	const mutateRef = useRef(mutation.mutate);
	mutateRef.current = mutation.mutate;

	useEffect(() => {
		if (subtotal <= 0) return;
		mutateRef.current({
			subtotal,
			itemCount,
			...(productIds ? { productIds } : {}),
			...(categoryIds ? { categoryIds } : {}),
		});
	}, [subtotal, itemCount, productIds, categoryIds]);

	if (mutation.isPending || !data || data.rules.length === 0) return null;

	const items = data.rules.map((r) => ({
		id: r.ruleId,
		name: r.ruleName,
		badge: formatDiscountValue(r.type, 0),
		amountFormatted: r.freeShipping
			? "Free shipping"
			: `−${formatCents(r.discountAmount)}`,
		isFreeShipping: r.freeShipping,
	}));

	return (
		<AutoAppliedSavingsTemplate
			items={items}
			totalFormatted={formatCents(data.totalDiscount)}
			freeShipping={data.freeShipping}
			hasMultiple={items.length > 1}
		/>
	);
}
