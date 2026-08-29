import type { ModuleController } from "@86d-app/core/types/module";

export type GiftCard = {
	id: string;
	code: string;
	initialBalance: number;
	currentBalance: number;
	currency: string;
	status: "active" | "disabled" | "expired" | "depleted";
	expiresAt?: string | undefined;
	recipientEmail?: string | undefined;
	recipientName?: string | undefined;
	customerId?: string | undefined;
	purchasedByCustomerId?: string | undefined;
	senderName?: string | undefined;
	senderEmail?: string | undefined;
	message?: string | undefined;
	deliveryMethod?: "email" | "physical" | "digital" | undefined;
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
	type: "debit" | "credit" | "purchase" | "topup";
	amount: number;
	balanceAfter: number;
	orderId?: string | undefined;
	customerId?: string | undefined;
	note?: string | undefined;
	createdAt: Date;
};

export type CreateGiftCardParams = {
	initialBalance: number;
	currency?: string | undefined;
	expiresAt?: string | undefined;
	recipientEmail?: string | undefined;
	recipientName?: string | undefined;
	customerId?: string | undefined;
	purchasedByCustomerId?: string | undefined;
	senderName?: string | undefined;
	senderEmail?: string | undefined;
	message?: string | undefined;
	deliveryMethod?: "email" | "physical" | "digital" | undefined;
	scheduledDeliveryAt?: string | undefined;
	purchaseOrderId?: string | undefined;
	note?: string | undefined;
};

export type PurchaseGiftCardParams = {
	amount: number;
	currency?: string | undefined;
	/** Purchasing customer ID (derived from session) */
	customerId: string;
	/** Purchasing customer email (derived from session) */
	customerEmail: string;
	/** If buying as a gift */
	recipientEmail?: string | undefined;
	recipientName?: string | undefined;
	senderName?: string | undefined;
	message?: string | undefined;
	deliveryMethod?: "email" | "digital" | undefined;
	scheduledDeliveryAt?: string | undefined;
};

export type TopUpParams = {
	/** Gift card ID */
	giftCardId: string;
	/** Customer performing the top-up (derived from session) */
	customerId: string;
	amount: number;
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

export type BulkCreateParams = {
	count: number;
	initialBalance: number;
	currency?: string | undefined;
	expiresAt?: string | undefined;
	note?: string | undefined;
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

export type RedeemResult = {
	transaction: GiftCardTransaction;
	giftCard: GiftCard;
};

export type GiftCardController = ModuleController & {
	create(params: CreateGiftCardParams): Promise<GiftCard>;

	get(id: string): Promise<GiftCard | null>;

	getByCode(code: string): Promise<GiftCard | null>;

	list(params?: {
		status?: string | undefined;
		customerId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<GiftCard[]>;

	update(
		id: string,
		data: Partial<
			Pick<
				GiftCard,
				| "status"
				| "expiresAt"
				| "note"
				| "recipientEmail"
				| "recipientName"
				| "delivered"
				| "deliveredAt"
			>
		>,
	): Promise<GiftCard | null>;

	delete(id: string): Promise<boolean>;

	checkBalance(code: string): Promise<{
		balance: number;
		currency: string;
		status: string;
	} | null>;

	redeem(
		code: string,
		amount: number,
		orderId?: string | undefined,
	): Promise<RedeemResult | null>;

	credit(
		id: string,
		amount: number,
		note?: string | undefined,
		orderId?: string | undefined,
	): Promise<RedeemResult | null>;

	listTransactions(
		giftCardId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<GiftCardTransaction[]>;

	countAll(): Promise<number>;

	/** Create a purchased gift card after authoritative payment confirmation */
	purchase(params: PurchaseGiftCardParams): Promise<GiftCard>;

	/** Add balance after authoritative payment confirmation */
	topUp(params: TopUpParams): Promise<RedeemResult | null>;

	/** Send a gift card to a recipient via email */
	sendGiftCard(params: SendGiftCardParams): Promise<GiftCard | null>;

	/** List gift cards for a specific customer */
	listByCustomer(
		customerId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<GiftCard[]>;

	/** Bulk create gift cards (admin) */
	bulkCreate(params: BulkCreateParams): Promise<GiftCard[]>;

	/** Get gift card statistics (admin) */
	getStats(): Promise<GiftCardStats>;

	/** Disable all expired gift cards */
	disableExpired(): Promise<number>;
};
