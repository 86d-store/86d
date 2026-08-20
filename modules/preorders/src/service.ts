import type { ModuleController } from "@86d-app/core/types/module";

export type CampaignStatus =
	| "draft"
	| "active"
	| "paused"
	| "completed"
	| "cancelled";

export type PreorderItemStatus =
	| "pending"
	| "confirmed"
	| "ready"
	| "fulfilled"
	| "cancelled"
	| "refunded";

export type PaymentType = "full" | "deposit";

export type PreorderCampaign = {
	id: string;
	productId: string;
	productName: string;
	variantId?: string | undefined;
	variantLabel?: string | undefined;
	status: CampaignStatus;
	paymentType: PaymentType;
	depositAmount?: number | undefined;
	depositPercent?: number | undefined;
	price: number;
	maxQuantity?: number | undefined;
	currentQuantity: number;
	startDate: Date;
	endDate?: Date | undefined;
	estimatedShipDate?: Date | undefined;
	message?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type PreorderItem = {
	id: string;
	campaignId: string;
	customerId: string;
	customerEmail: string;
	quantity: number;
	status: PreorderItemStatus;
	depositPaid: number;
	totalPrice: number;
	orderId?: string | undefined;
	notifiedAt?: Date | undefined;
	cancelledAt?: Date | undefined;
	cancelReason?: string | undefined;
	fulfilledAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type PreorderSummary = {
	totalCampaigns: number;
	activeCampaigns: number;
	totalItems: number;
	pendingItems: number;
	confirmedItems: number;
	fulfilledItems: number;
	cancelledItems: number;
	totalRevenue: number;
	totalDeposits: number;
};

export type PreordersController = ModuleController & {
	createCampaign(params: {
		productId: string;
		productName: string;
		variantId?: string | undefined;
		variantLabel?: string | undefined;
		paymentType: PaymentType;
		depositAmount?: number | undefined;
		depositPercent?: number | undefined;
		price: number;
		maxQuantity?: number | undefined;
		startDate: Date;
		endDate?: Date | undefined;
		estimatedShipDate?: Date | undefined;
		message?: string | undefined;
	}): Promise<PreorderCampaign>;

	getCampaign(id: string): Promise<PreorderCampaign | null>;

	listCampaigns(params?: {
		status?: CampaignStatus | undefined;
		productId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<PreorderCampaign[]>;

	updateCampaign(
		id: string,
		updates: {
			productName?: string | undefined;
			paymentType?: PaymentType | undefined;
			depositAmount?: number | undefined;
			depositPercent?: number | undefined;
			price?: number | undefined;
			maxQuantity?: number | undefined;
			endDate?: Date | undefined;
			estimatedShipDate?: Date | undefined;
			message?: string | undefined;
		},
	): Promise<PreorderCampaign | null>;

	activateCampaign(id: string): Promise<PreorderCampaign | null>;

	pauseCampaign(id: string): Promise<PreorderCampaign | null>;

	completeCampaign(id: string): Promise<PreorderCampaign | null>;

	cancelCampaign(
		id: string,
		reason?: string | undefined,
	): Promise<PreorderCampaign | null>;

	placePreorder(params: {
		campaignId: string;
		customerId: string;
		customerEmail: string;
		quantity: number;
	}): Promise<PreorderItem | null>;

	getPreorderItem(id: string): Promise<PreorderItem | null>;

	listPreorderItems(params?: {
		campaignId?: string | undefined;
		customerId?: string | undefined;
		status?: PreorderItemStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<PreorderItem[]>;

	getCustomerPreorders(
		customerId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<PreorderItem[]>;

	cancelPreorderItem(
		id: string,
		reason?: string | undefined,
	): Promise<PreorderItem | null>;

	fulfillPreorderItem(
		id: string,
		orderId?: string | undefined,
	): Promise<PreorderItem | null>;

	markReady(id: string): Promise<PreorderItem | null>;

	notifyCustomers(
		campaignId: string,
	): Promise<{ notified: number; itemIds: string[] }>;

	getSummary(): Promise<PreorderSummary>;

	getActiveCampaignForProduct(
		productId: string,
		variantId?: string | undefined,
	): Promise<PreorderCampaign | null>;
};
