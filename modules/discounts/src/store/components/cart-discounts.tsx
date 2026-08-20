"use client";

import { formatCents } from "./_utils";
import CartDiscountsTemplate from "./cart-discounts.mdx";

interface AppliedDiscount {
	label: string;
	amount: number;
	type: "code" | "auto";
}

export function CartDiscounts({
	discounts,
	onRemoveCode,
}: {
	discounts: AppliedDiscount[];
	onRemoveCode?: (() => void) | undefined;
}) {
	if (discounts.length === 0) return null;

	const totalSavings = discounts.reduce((sum, d) => sum + d.amount, 0);

	const items = discounts.map((d, i) => ({
		key: `${d.type}-${i}`,
		label: d.label,
		amountFormatted: formatCents(d.amount),
		isCode: d.type === "code",
	}));

	return (
		<CartDiscountsTemplate
			items={items}
			totalSavings={formatCents(totalSavings)}
			hasMultiple={items.length > 1}
			onRemoveCode={onRemoveCode}
			hasCodeDiscount={items.some((i) => i.isCode)}
		/>
	);
}
