export type PaymentIntentStatus =
	| "pending"
	| "processing"
	| "succeeded"
	| "failed"
	| "cancelled"
	| "refunded";

export type RevenueStats = {
	totalVolume: number;
	transactionCount: number;
	averageValue: number;
	currency: string;
	byStatus: Record<PaymentIntentStatus, number>;
	refundVolume: number;
	refundCount: number;
};

export type RevenueTransaction = {
	id: string;
	providerIntentId?: string | undefined;
	email?: string | undefined;
	customerId?: string | undefined;
	orderId?: string | undefined;
	amount: number;
	currency: string;
	status: PaymentIntentStatus;
	createdAt: Date;
	updatedAt: Date;
};

export type RevenueIntent = {
	id: string;
	providerIntentId?: string | undefined;
	customerId?: string | undefined;
	email?: string | undefined;
	amount: number;
	currency: string;
	status: string;
	orderId?: string | undefined;
	createdAt: Date | string;
	updatedAt: Date | string;
};

export type RevenuePaymentsController = {
	listIntents(params?: {
		customerId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<RevenueIntent[]>;
};
