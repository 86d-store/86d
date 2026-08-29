import type { ModuleDataService } from "@86d-app/core/types/module";

function storedAmount(
	record: Record<string, unknown>,
	field: "subtotal" | "taxAmount" | "shippingAmount" | "discountAmount",
): number {
	const value = record[field];
	if (typeof value !== "number") {
		throw new Error(`Legacy Checkout fixture is missing ${field}`);
	}
	return value;
}

/**
 * Seeds a persisted pre-containment gift-card application without recreating
 * any public or controller mutation surface.
 */
export async function seedLegacyStoredGiftCard(
	data: ModuleDataService,
	sessionId: string,
	input: { code: string; amount: number },
): Promise<void> {
	const stored = await data.get("checkoutSession", sessionId);
	if (!stored) {
		throw new Error(`Checkout session ${sessionId} was not persisted`);
	}

	const total = Math.max(
		0,
		storedAmount(stored, "subtotal") +
			storedAmount(stored, "taxAmount") +
			storedAmount(stored, "shippingAmount") -
			storedAmount(stored, "discountAmount") -
			input.amount,
	);

	await data.upsert("checkoutSession", sessionId, {
		...stored,
		giftCardCode: input.code,
		giftCardAmount: input.amount,
		total,
	});
}
