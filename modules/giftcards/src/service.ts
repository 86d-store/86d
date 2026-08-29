import type { ModuleController } from "@86d-app/core/types/module";

export type GiftCard = {
	id: string;
	code: string;
	initialBalance: number;
	currentBalance: number;
	currency: string;
	status: string;
	expiresAt?: string | undefined;
	recipientEmail?: string | undefined;
	recipientName?: string | undefined;
	customerId?: string | undefined;
	purchasedByCustomerId?: string | undefined;
	senderName?: string | undefined;
	senderEmail?: string | undefined;
	message?: string | undefined;
	deliveryMethod?: string | undefined;
	delivered?: boolean | undefined;
	deliveredAt?: Date | undefined;
	scheduledDeliveryAt?: string | undefined;
	purchaseOrderId?: string | undefined;
	note?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type GiftCardTransaction = {
	id: string;
	giftCardId: string;
	type: string;
	amount: number;
	balanceAfter: number;
	orderId?: string | undefined;
	customerId?: string | undefined;
	note?: string | undefined;
	createdAt: Date;
};

export type SendGiftCardParams = {
	/** Gift card ID */
	giftCardId: string;
	/** Customer who owns the card (derived from session) */
	customerId: string;
	recipientEmail: string;
	recipientName?: string | undefined;
	senderName?: string | undefined;
	message?: string | undefined;
};

export type GiftCardStats = {
	totalIssued: number;
	totalActive: number;
	totalDepleted: number;
	totalDisabled: number;
	totalExpired: number;
	totalIssuedValue: number;
	totalRedeemedValue: number;
	totalOutstandingBalance: number;
};

export const GIFT_CARD_ADMIN_SORT_FIELDS = [
	"code",
	"balance",
	"status",
	"recipient",
	"createdAt",
] as const;

export type GiftCardAdminSortField =
	(typeof GIFT_CARD_ADMIN_SORT_FIELDS)[number];

export type GiftCardSortDirection = "asc" | "desc";

export type GiftCardAdminListParams = {
	status?: string | undefined;
	customerId?: string | undefined;
	search?: string | undefined;
	sort?: GiftCardAdminSortField | undefined;
	direction?: GiftCardSortDirection | undefined;
	take?: number | undefined;
	skip?: number | undefined;
};

export type GiftCardAdminListPage = {
	cards: GiftCard[];
	total: number;
};

export type GiftCardController = ModuleController & {
	get(id: string): Promise<GiftCard | null>;

	getByCode(code: string): Promise<GiftCard | null>;

	list(params?: {
		status?: string | undefined;
		customerId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<GiftCard[]>;

	/** Query one admin page after applying filters and ordering to all records */
	listAdminPage(
		params?: GiftCardAdminListParams,
	): Promise<GiftCardAdminListPage>;

	checkBalance(code: string): Promise<{
		balance: number;
		currency: string;
		status: string;
	} | null>;

	listTransactions(
		giftCardId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<GiftCardTransaction[]>;

	countAll(): Promise<number>;

	/** Record intended email-delivery metadata without confirming delivery */
	sendGiftCard(params: SendGiftCardParams): Promise<GiftCard | null>;

	/** List gift cards for a specific customer */
	listByCustomer(
		customerId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<GiftCard[]>;

	/** Get gift card statistics (admin) */
	getStats(): Promise<GiftCardStats>;
};
