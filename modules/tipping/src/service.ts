import type { ModuleController } from "@86d-app/core/types/module";

export type Tip = {
	id: string;
	orderId: string;
	amount: number;
	percentage?: number | undefined;
	type: "preset" | "custom";
	recipientType: "driver" | "server" | "staff" | "store";
	recipientId?: string | undefined;
	customerId?: string | undefined;
	status: "pending" | "paid" | "refunded";
	paidAt?: Date | undefined;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type TipPayout = {
	id: string;
	recipientId: string;
	recipientType: string;
	amount: number;
	tipCount: number;
	periodStart: Date;
	periodEnd: Date;
	status: "pending" | "processing" | "paid" | "failed";
	paidAt?: Date | undefined;
	reference?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type TipSettings = {
	id: string;
	presetPercents: number[];
	allowCustom: boolean;
	maxPercent: number;
	maxAmount: number;
	enableSplitting: boolean;
	defaultRecipientType: string;
	updatedAt: Date;
};

export type AddTipParams = {
	orderId: string;
	amount: number;
	percentage?: number | undefined;
	type: "preset" | "custom";
	recipientType?: "driver" | "server" | "staff" | "store" | undefined;
	recipientId?: string | undefined;
	customerId?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
};

export type UpdateTipParams = {
	amount?: number | undefined;
	percentage?: number | undefined;
	recipientType?: "driver" | "server" | "staff" | "store" | undefined;
	recipientId?: string | undefined;
	status?: "pending" | "paid" | "refunded" | undefined;
};

export type SplitEntry = {
	recipientType: "driver" | "server" | "staff" | "store";
	recipientId?: string | undefined;
	amount: number;
};

export type CreatePayoutParams = {
	recipientId: string;
	recipientType: string;
	amount: number;
	tipCount: number;
	periodStart: Date;
	periodEnd: Date;
	reference?: string | undefined;
};

export type TipStats = {
	totalTips: number;
	totalAmount: number;
	totalPending: number;
	totalPaid: number;
	totalRefunded: number;
	averageTip: number;
	totalPayouts: number;
	totalPayoutAmount: number;
};

export type TippingController = ModuleController & {
	addTip(params: AddTipParams): Promise<Tip>;

	updateTip(id: string, params: UpdateTipParams): Promise<Tip | null>;

	removeTip(id: string): Promise<boolean>;

	getTip(id: string): Promise<Tip | null>;

	listTips(params?: {
		orderId?: string | undefined;
		recipientId?: string | undefined;
		status?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Tip[]>;

	splitTip(id: string, splits: SplitEntry[]): Promise<Tip[]>;

	getTipTotal(orderId: string): Promise<number>;

	createPayout(params: CreatePayoutParams): Promise<TipPayout>;

	getPayout(id: string): Promise<TipPayout | null>;

	listPayouts(params?: {
		recipientId?: string | undefined;
		status?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<TipPayout[]>;

	getSettings(): Promise<TipSettings>;

	updateSettings(
		params: Partial<
			Pick<
				TipSettings,
				| "presetPercents"
				| "allowCustom"
				| "maxPercent"
				| "maxAmount"
				| "enableSplitting"
				| "defaultRecipientType"
			>
		>,
	): Promise<TipSettings>;

	getTipStats(params?: {
		startDate?: Date | undefined;
		endDate?: Date | undefined;
	}): Promise<TipStats>;
};
