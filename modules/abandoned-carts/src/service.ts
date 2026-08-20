import type { ModuleController } from "@86d-app/core/types/module";

export type CartItemSnapshot = {
	productId: string;
	variantId?: string | undefined;
	name: string;
	sku?: string | undefined;
	price: number;
	quantity: number;
	imageUrl?: string | undefined;
};

export type AbandonedCart = {
	id: string;
	cartId: string;
	customerId?: string | undefined;
	email?: string | undefined;
	items: CartItemSnapshot[];
	cartTotal: number;
	currency: string;
	status: "active" | "recovered" | "expired" | "dismissed";
	recoveryToken: string;
	attemptCount: number;
	lastActivityAt: Date;
	abandonedAt: Date;
	recoveredAt?: Date | undefined;
	recoveredOrderId?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type RecoveryAttempt = {
	id: string;
	abandonedCartId: string;
	channel: "email" | "sms" | "push";
	recipient: string;
	status: "sent" | "delivered" | "opened" | "clicked" | "failed";
	subject?: string | undefined;
	openedAt?: Date | undefined;
	clickedAt?: Date | undefined;
	sentAt: Date;
	createdAt: Date;
};

export type CreateAbandonedCartParams = {
	cartId: string;
	customerId?: string | undefined;
	email?: string | undefined;
	items: CartItemSnapshot[];
	cartTotal: number;
	currency?: string | undefined;
};

export type RecordAttemptParams = {
	abandonedCartId: string;
	channel: "email" | "sms" | "push";
	recipient: string;
	subject?: string | undefined;
};

export type AbandonedCartStats = {
	totalAbandoned: number;
	totalRecovered: number;
	totalExpired: number;
	totalDismissed: number;
	recoveryRate: number;
	totalRecoveredValue: number;
};

export type AbandonedCartWithAttempts = AbandonedCart & {
	attempts: RecoveryAttempt[];
};

export type AbandonedCartControllerOptions = {
	/** Maximum recovery attempts per cart (default: 3) */
	maxRecoveryAttempts: number;
	/** Days before auto-expiration (default: 30) */
	expirationDays: number;
	/** Minutes of inactivity before cart considered abandoned (default: 60) */
	abandonmentThresholdMinutes: number;
};

export type AbandonedCartController = ModuleController & {
	create(params: CreateAbandonedCartParams): Promise<AbandonedCart>;

	get(id: string): Promise<AbandonedCart | null>;

	getByToken(token: string): Promise<AbandonedCart | null>;

	getByCartId(cartId: string): Promise<AbandonedCart | null>;

	list(params?: {
		status?: string | undefined;
		email?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<AbandonedCart[]>;

	markRecovered(id: string, orderId: string): Promise<AbandonedCart | null>;

	markExpired(id: string): Promise<AbandonedCart | null>;

	dismiss(id: string): Promise<AbandonedCart | null>;

	delete(id: string): Promise<boolean>;

	recordAttempt(params: RecordAttemptParams): Promise<RecoveryAttempt>;

	updateAttemptStatus(
		attemptId: string,
		status: "delivered" | "opened" | "clicked" | "failed",
	): Promise<RecoveryAttempt | null>;

	listAttempts(abandonedCartId: string): Promise<RecoveryAttempt[]>;

	getWithAttempts(id: string): Promise<AbandonedCartWithAttempts | null>;

	getStats(): Promise<AbandonedCartStats>;

	countAll(): Promise<number>;

	bulkExpire(olderThanDays?: number): Promise<number>;

	/** Returns the resolved controller options */
	getOptions(): AbandonedCartControllerOptions;
};
