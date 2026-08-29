export type GiftCardStatus = "active" | "disabled" | "expired" | "depleted";

export const GIFT_CARD_ADMIN_SORT_FIELDS = [
	"code",
	"balance",
	"status",
	"recipient",
	"createdAt",
] as const;

export type GiftCardAdminSortField =
	(typeof GIFT_CARD_ADMIN_SORT_FIELDS)[number];

export interface GiftCardAdminRecord {
	id: string;
	code: string;
	initialBalance: number;
	currentBalance: number;
	currency: string;
	status: string;
	expiresAt?: string;
	recipientEmail?: string;
	note?: string;
	createdAt: string;
}

export interface GiftCardAdminTransaction {
	id: string;
	type: string;
	amount: number;
	balanceAfter: number;
	orderId?: string;
	note?: string;
	createdAt: string;
}

export interface GiftCardAdminStats {
	totalIssued: number;
	totalActive: number;
	totalDepleted: number;
	totalDisabled: number;
	totalExpired: number;
}

export const GIFT_CARD_STATUSES = [
	"active",
	"disabled",
	"expired",
	"depleted",
] as const satisfies readonly GiftCardStatus[];

export function isGiftCardStatus(value: string): value is GiftCardStatus {
	return GIFT_CARD_STATUSES.some((status) => status === value);
}

export function isGiftCardAdminSortField(
	value: string,
): value is GiftCardAdminSortField {
	return GIFT_CARD_ADMIN_SORT_FIELDS.some((field) => field === value);
}
