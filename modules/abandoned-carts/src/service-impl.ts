import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	AbandonedCart,
	AbandonedCartController,
	AbandonedCartControllerOptions,
	AbandonedCartStats,
	AbandonedCartWithAttempts,
	CreateAbandonedCartParams,
	RecordAttemptParams,
	RecoveryAttempt,
} from "./service";

const DEFAULT_OPTIONS: AbandonedCartControllerOptions = {
	maxRecoveryAttempts: 3,
	expirationDays: 30,
	abandonmentThresholdMinutes: 60,
};

export type EventEmitter = {
	emit(event: string, payload: Record<string, unknown>): Promise<void>;
};

export function createAbandonedCartController(
	data: ModuleDataService,
	opts?: Partial<AbandonedCartControllerOptions>,
	eventEmitter?: EventEmitter,
): AbandonedCartController {
	const options: AbandonedCartControllerOptions = {
		...DEFAULT_OPTIONS,
		...opts,
	};

	const events = eventEmitter ?? {
		emit: async () => {},
	};
	async function getAttempts(
		abandonedCartId: string,
	): Promise<RecoveryAttempt[]> {
		const results = await data.findMany("recoveryAttempt", {
			where: { abandonedCartId },
		});
		return results as unknown as RecoveryAttempt[];
	}

	async function allCarts(): Promise<AbandonedCart[]> {
		const results = await data.findMany("abandonedCart", {});
		return results as unknown as AbandonedCart[];
	}

	return {
		async create(params: CreateAbandonedCartParams): Promise<AbandonedCart> {
			const id = crypto.randomUUID();
			const now = new Date();
			const recoveryToken = crypto.randomUUID();

			const cart: AbandonedCart = {
				id,
				cartId: params.cartId,
				customerId: params.customerId,
				email: params.email,
				items: params.items,
				cartTotal: params.cartTotal,
				currency: params.currency ?? "USD",
				status: "active",
				recoveryToken,
				attemptCount: 0,
				lastActivityAt: now,
				abandonedAt: now,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("abandonedCart", id, cart as Record<string, unknown>);
			return cart;
		},

		async get(id: string): Promise<AbandonedCart | null> {
			const raw = await data.get("abandonedCart", id);
			if (!raw) return null;
			return raw as unknown as AbandonedCart;
		},

		async getByToken(token: string): Promise<AbandonedCart | null> {
			const results = await data.findMany("abandonedCart", {
				where: { recoveryToken: token },
				take: 1,
			});
			const carts = results as unknown as AbandonedCart[];
			return carts.length > 0 ? carts[0] : null;
		},

		async getByCartId(cartId: string): Promise<AbandonedCart | null> {
			const results = await data.findMany("abandonedCart", {
				where: { cartId },
				take: 1,
			});
			const carts = results as unknown as AbandonedCart[];
			return carts.length > 0 ? carts[0] : null;
		},

		async list(params): Promise<AbandonedCart[]> {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.email) where.email = params.email;

			const results = await data.findMany("abandonedCart", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as AbandonedCart[];
		},

		async markRecovered(
			id: string,
			orderId: string,
		): Promise<AbandonedCart | null> {
			const existing = await data.get("abandonedCart", id);
			if (!existing) return null;

			const cart = existing as unknown as AbandonedCart;
			const updated: AbandonedCart = {
				...cart,
				status: "recovered",
				recoveredAt: new Date(),
				recoveredOrderId: orderId,
				updatedAt: new Date(),
			};

			await data.upsert(
				"abandonedCart",
				id,
				updated as Record<string, unknown>,
			);

			await events.emit("cart.recovered", {
				cartId: id,
				orderId,
				email: cart.email,
				cartTotal: cart.cartTotal,
				currency: cart.currency,
			});

			return updated;
		},

		async markExpired(id: string): Promise<AbandonedCart | null> {
			const existing = await data.get("abandonedCart", id);
			if (!existing) return null;

			const cart = existing as unknown as AbandonedCart;
			const updated: AbandonedCart = {
				...cart,
				status: "expired",
				updatedAt: new Date(),
			};

			await data.upsert(
				"abandonedCart",
				id,
				updated as Record<string, unknown>,
			);

			await events.emit("cart.expired", {
				cartId: id,
				email: cart.email,
				cartTotal: cart.cartTotal,
			});

			return updated;
		},

		async dismiss(id: string): Promise<AbandonedCart | null> {
			const existing = await data.get("abandonedCart", id);
			if (!existing) return null;

			const cart = existing as unknown as AbandonedCart;
			const updated: AbandonedCart = {
				...cart,
				status: "dismissed",
				updatedAt: new Date(),
			};

			await data.upsert(
				"abandonedCart",
				id,
				updated as Record<string, unknown>,
			);

			await events.emit("cart.dismissed", {
				cartId: id,
				email: cart.email,
				cartTotal: cart.cartTotal,
			});

			return updated;
		},

		async delete(id: string): Promise<boolean> {
			const existing = await data.get("abandonedCart", id);
			if (!existing) return false;

			const attempts = await getAttempts(id);
			for (const attempt of attempts) {
				await data.delete("recoveryAttempt", attempt.id);
			}

			await data.delete("abandonedCart", id);
			return true;
		},

		async recordAttempt(params: RecordAttemptParams): Promise<RecoveryAttempt> {
			// Enforce maxRecoveryAttempts
			const existingCart = await data.get(
				"abandonedCart",
				params.abandonedCartId,
			);
			if (existingCart) {
				const c = existingCart as unknown as AbandonedCart;
				if (c.attemptCount >= options.maxRecoveryAttempts) {
					throw new Error(
						`Maximum recovery attempts (${options.maxRecoveryAttempts}) reached for this cart`,
					);
				}
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const attempt: RecoveryAttempt = {
				id,
				abandonedCartId: params.abandonedCartId,
				channel: params.channel,
				recipient: params.recipient,
				status: "sent",
				subject: params.subject,
				sentAt: now,
				createdAt: now,
			};

			await data.upsert(
				"recoveryAttempt",
				id,
				attempt as Record<string, unknown>,
			);

			// Increment attempt count on the cart
			if (existingCart) {
				const c = existingCart as unknown as AbandonedCart;
				await data.upsert("abandonedCart", c.id, {
					...c,
					attemptCount: c.attemptCount + 1,
					updatedAt: new Date(),
				} as Record<string, unknown>);
			}

			return attempt;
		},

		async updateAttemptStatus(
			attemptId: string,
			status: "delivered" | "opened" | "clicked" | "failed",
		): Promise<RecoveryAttempt | null> {
			const existing = await data.get("recoveryAttempt", attemptId);
			if (!existing) return null;

			const attempt = existing as unknown as RecoveryAttempt;
			const updated: RecoveryAttempt = { ...attempt, status };

			if (status === "opened" && !attempt.openedAt) {
				(updated as { openedAt: Date }).openedAt = new Date();
			}
			if (status === "clicked" && !attempt.clickedAt) {
				(updated as { clickedAt: Date }).clickedAt = new Date();
			}

			await data.upsert(
				"recoveryAttempt",
				attemptId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async listAttempts(abandonedCartId: string): Promise<RecoveryAttempt[]> {
			return getAttempts(abandonedCartId);
		},

		async getWithAttempts(
			id: string,
		): Promise<AbandonedCartWithAttempts | null> {
			const cart = await data.get("abandonedCart", id);
			if (!cart) return null;
			const attempts = await getAttempts(id);
			return { ...(cart as unknown as AbandonedCart), attempts };
		},

		async getStats(): Promise<AbandonedCartStats> {
			const carts = await allCarts();
			let totalRecoveredValue = 0;
			let totalAbandoned = 0;
			let totalRecovered = 0;
			let totalExpired = 0;
			let totalDismissed = 0;

			for (const cart of carts) {
				switch (cart.status) {
					case "active":
						totalAbandoned++;
						break;
					case "recovered":
						totalRecovered++;
						totalRecoveredValue += cart.cartTotal;
						break;
					case "expired":
						totalExpired++;
						break;
					case "dismissed":
						totalDismissed++;
						break;
				}
			}

			const total = carts.length;
			const recoveryRate = total > 0 ? totalRecovered / total : 0;

			return {
				totalAbandoned,
				totalRecovered,
				totalExpired,
				totalDismissed,
				recoveryRate,
				totalRecoveredValue,
			};
		},

		async countAll(): Promise<number> {
			const carts = await allCarts();
			return carts.length;
		},

		getOptions(): AbandonedCartControllerOptions {
			return { ...options };
		},

		async bulkExpire(olderThanDays?: number): Promise<number> {
			const days = olderThanDays ?? options.expirationDays;
			const carts = await allCarts();
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - days);
			cutoff.setHours(0, 0, 0, 0);

			let expired = 0;
			for (const cart of carts) {
				if (cart.status === "active" && new Date(cart.abandonedAt) < cutoff) {
					await data.upsert("abandonedCart", cart.id, {
						...cart,
						status: "expired",
						updatedAt: new Date(),
					} as Record<string, unknown>);

					await events.emit("cart.expired", {
						cartId: cart.id,
						email: cart.email,
						cartTotal: cart.cartTotal,
					});

					expired++;
				}
			}
			return expired;
		},
	};
}
