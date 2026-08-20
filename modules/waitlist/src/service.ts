import type { ModuleController } from "@86d-app/core/types/module";

export type WaitlistStatus = "waiting" | "notified" | "purchased" | "cancelled";

export type WaitlistEntry = {
	id: string;
	productId: string;
	productName: string;
	variantId?: string | undefined;
	variantLabel?: string | undefined;
	email: string;
	customerId?: string | undefined;
	status: WaitlistStatus;
	notifiedAt?: Date | undefined;
	createdAt: Date;
};

export type WaitlistSummary = {
	totalWaiting: number;
	totalNotified: number;
	topProducts: Array<{
		productId: string;
		productName: string;
		count: number;
	}>;
};

export type WaitlistController = ModuleController & {
	subscribe(params: {
		productId: string;
		productName: string;
		variantId?: string | undefined;
		variantLabel?: string | undefined;
		email: string;
		customerId?: string | undefined;
	}): Promise<WaitlistEntry>;

	unsubscribe(id: string): Promise<boolean>;

	cancelByEmail(email: string, productId: string): Promise<boolean>;

	getEntry(id: string): Promise<WaitlistEntry | null>;

	isSubscribed(email: string, productId: string): Promise<boolean>;

	listByProduct(
		productId: string,
		params?: {
			status?: WaitlistStatus | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<WaitlistEntry[]>;

	listByEmail(
		email: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<WaitlistEntry[]>;

	listAll(params?: {
		productId?: string | undefined;
		email?: string | undefined;
		status?: WaitlistStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<WaitlistEntry[]>;

	countByProduct(productId: string): Promise<number>;

	markNotified(productId: string): Promise<number>;

	markPurchased(email: string, productId: string): Promise<boolean>;

	getSummary(): Promise<WaitlistSummary>;
};
