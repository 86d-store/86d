export function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

export function hasRetainedLegacyGiftCard({
	giftCardCode,
	giftCardAmount,
}: {
	giftCardCode: string | null | undefined;
	giftCardAmount: number;
}): boolean {
	return giftCardCode !== undefined || giftCardAmount !== 0;
}

export function legacyGiftCardRecoveryLabel(
	giftCardCode: string | null | undefined,
): string {
	return giftCardCode?.trim() || "Stored gift card";
}

export function legacyGiftCardAdjustmentPresentation(
	giftCardAmount: number,
): { label: string; signedAmount: string } | null {
	if (giftCardAmount >= 0) return null;

	return {
		label: "Legacy gift card adjustment",
		signedAmount: `+${formatPrice(Math.abs(giftCardAmount))}`,
	};
}
