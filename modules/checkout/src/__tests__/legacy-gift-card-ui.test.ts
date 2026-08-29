import { describe, expect, it } from "vitest";
import {
	formatPrice,
	hasRetainedLegacyGiftCard,
	legacyGiftCardAdjustmentPresentation,
	legacyGiftCardRecoveryLabel,
} from "../store/components/_utils";

describe("legacy gift-card recovery UI", () => {
	it.each([
		{
			label: "a stored code",
			giftCardCode: "GIFT-LEGACY",
			giftCardAmount: 0,
		},
		{ label: "an empty stored code", giftCardCode: "", giftCardAmount: 0 },
		{ label: "a null stored code", giftCardCode: null, giftCardAmount: 0 },
		{
			label: "a positive amount without a code",
			giftCardCode: undefined,
			giftCardAmount: 1,
		},
		{
			label: "a negative amount without a code",
			giftCardCode: undefined,
			giftCardAmount: -1,
		},
	])("retains removal for $label", ({ giftCardCode, giftCardAmount }) => {
		expect(hasRetainedLegacyGiftCard({ giftCardCode, giftCardAmount })).toBe(
			true,
		);
	});

	it("hides removal only when both finalizer fields are clean", () => {
		expect(
			hasRetainedLegacyGiftCard({
				giftCardCode: undefined,
				giftCardAmount: 0,
			}),
		).toBe(false);
	});

	it.each([undefined, null, "", "   "])(
		"uses a privacy-safe fallback for absent code %j",
		(giftCardCode) => {
			expect(legacyGiftCardRecoveryLabel(giftCardCode)).toBe(
				"Stored gift card",
			);
		},
	);

	it("preserves a nonempty stored code", () => {
		expect(legacyGiftCardRecoveryLabel("  GIFT-LEGACY  ")).toBe("GIFT-LEGACY");
	});

	it.each([
		{ giftCardCode: undefined, expectedLabel: "Stored gift card" },
		{ giftCardCode: "GIFT-LEGACY", expectedLabel: "GIFT-LEGACY" },
	])(
		"presents exact negative adjustment math for code $giftCardCode",
		({ giftCardCode, expectedLabel }) => {
			const giftCardAmount = -500;
			const subtotal = 23_700;

			expect(legacyGiftCardRecoveryLabel(giftCardCode)).toBe(expectedLabel);
			expect(legacyGiftCardAdjustmentPresentation(giftCardAmount)).toEqual({
				label: "Legacy gift card adjustment",
				signedAmount: "+$5.00",
			});
			expect(formatPrice(subtotal - giftCardAmount)).toBe("$242.00");
		},
	);

	it.each([0, 500])(
		"does not create a legacy increase for nonnegative amount %d",
		(giftCardAmount) => {
			expect(legacyGiftCardAdjustmentPresentation(giftCardAmount)).toBeNull();
		},
	);
});
