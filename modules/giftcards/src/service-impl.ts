import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	BulkCreateParams,
	CreateGiftCardParams,
	GiftCard,
	GiftCardController,
	GiftCardStats,
	GiftCardTransaction,
	PurchaseGiftCardParams,
	RedeemResult,
	SendGiftCardParams,
	TopUpParams,
} from "./service";

function supportsRowLock(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		typeof (transaction as Partial<LockingModuleDataTransaction>)
			.getForUpdate === "function"
	);
}

/**
 * Generate a unique gift card code in the format GIFT-XXXX-XXXX-XXXX
 * Uses uppercase alphanumeric characters (no ambiguous chars like 0/O, 1/I/L)
 */
function generateCode(): string {
	const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
	const segment = () => {
		let s = "";
		for (let i = 0; i < 4; i++) {
			s += chars[Math.floor(Math.random() * chars.length)];
		}
		return s;
	};
	return `GIFT-${segment()}-${segment()}-${segment()}`;
}

export function createGiftCardController(
	data: ModuleDataService,
	transactions?: ModuleTransactionRunner | undefined,
): GiftCardController {
	return {
		async create(params: CreateGiftCardParams): Promise<GiftCard> {
			const id = crypto.randomUUID();
			const code = generateCode();
			const now = new Date();

			const card: GiftCard = {
				id,
				code,
				initialBalance: params.initialBalance,
				currentBalance: params.initialBalance,
				currency: params.currency ?? "USD",
				status: "active",
				expiresAt: params.expiresAt,
				recipientEmail: params.recipientEmail,
				recipientName: params.recipientName,
				customerId: params.customerId,
				purchasedByCustomerId: params.purchasedByCustomerId,
				senderName: params.senderName,
				senderEmail: params.senderEmail,
				message: params.message,
				deliveryMethod: params.deliveryMethod,
				delivered: false,
				scheduledDeliveryAt: params.scheduledDeliveryAt,
				purchaseOrderId: params.purchaseOrderId,
				note: params.note,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("giftCard", id, card as Record<string, unknown>);
			return card;
		},

		async get(id: string): Promise<GiftCard | null> {
			const raw = await data.get("giftCard", id);
			if (!raw) return null;
			return raw as unknown as GiftCard;
		},

		async getByCode(code: string): Promise<GiftCard | null> {
			const results = await data.findMany("giftCard", {
				where: { code: code.toUpperCase() },
				take: 1,
			});
			const cards = results as unknown as GiftCard[];
			return cards.length > 0 ? cards[0] : null;
		},

		async list(params): Promise<GiftCard[]> {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.customerId) where.customerId = params.customerId;

			const results = await data.findMany("giftCard", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as GiftCard[];
		},

		async update(id, updates): Promise<GiftCard | null> {
			const existing = await data.get("giftCard", id);
			if (!existing) return null;

			const card = existing as unknown as GiftCard;
			const updated: GiftCard = {
				...card,
				...(updates.status !== undefined ? { status: updates.status } : {}),
				...(updates.expiresAt !== undefined
					? { expiresAt: updates.expiresAt }
					: {}),
				...(updates.note !== undefined ? { note: updates.note } : {}),
				...(updates.recipientEmail !== undefined
					? { recipientEmail: updates.recipientEmail }
					: {}),
				...(updates.recipientName !== undefined
					? { recipientName: updates.recipientName }
					: {}),
				...(updates.delivered !== undefined
					? { delivered: updates.delivered }
					: {}),
				...(updates.deliveredAt !== undefined
					? { deliveredAt: updates.deliveredAt }
					: {}),
				updatedAt: new Date(),
			};

			await data.upsert("giftCard", id, updated as Record<string, unknown>);
			return updated;
		},

		async delete(id: string): Promise<boolean> {
			const existing = await data.get("giftCard", id);
			if (!existing) return false;

			// Delete associated transactions first
			const txns = await data.findMany("giftCardTransaction", {
				where: { giftCardId: id },
			});
			for (const txn of txns as unknown as GiftCardTransaction[]) {
				await data.delete("giftCardTransaction", txn.id);
			}

			await data.delete("giftCard", id);
			return true;
		},

		async checkBalance(code: string): Promise<{
			balance: number;
			currency: string;
			status: string;
		} | null> {
			const results = await data.findMany("giftCard", {
				where: { code: code.toUpperCase() },
				take: 1,
			});
			const cards = results as unknown as GiftCard[];
			if (cards.length === 0) return null;

			const card = cards[0];

			// Check expiration
			if (card.expiresAt && new Date(card.expiresAt) < new Date()) {
				return {
					balance: 0,
					currency: card.currency,
					status: "expired",
				};
			}

			return {
				balance: card.currentBalance,
				currency: card.currency,
				status: card.status,
			};
		},

		async redeem(
			code: string,
			amount: number,
			orderId?: string | undefined,
		): Promise<RedeemResult | null> {
			const results = await data.findMany("giftCard", {
				where: { code: code.toUpperCase() },
				take: 1,
			});
			const cards = results as unknown as GiftCard[];
			if (cards.length === 0) return null;

			const card = cards[0];

			const redeemLocked = async (
				transaction: Pick<
					LockingModuleDataTransaction,
					"getForUpdate" | "upsert"
				>,
			): Promise<RedeemResult | null> => {
				const locked = await transaction.getForUpdate("giftCard", card.id);
				if (!locked) return null;
				const current = locked as unknown as GiftCard;

				if (current.status !== "active") return null;
				if (current.expiresAt && new Date(current.expiresAt) < new Date()) {
					return null;
				}
				if (current.currentBalance <= 0 || amount <= 0) return null;

				const debitAmount = Math.min(amount, current.currentBalance);
				const newBalance = current.currentBalance - debitAmount;
				const updatedCard: GiftCard = {
					...current,
					currentBalance: newBalance,
					status: newBalance === 0 ? "depleted" : "active",
					updatedAt: new Date(),
				};

				await transaction.upsert(
					"giftCard",
					current.id,
					updatedCard as Record<string, unknown>,
				);

				const txn: GiftCardTransaction = {
					id: crypto.randomUUID(),
					giftCardId: current.id,
					type: "debit",
					amount: debitAmount,
					balanceAfter: newBalance,
					orderId,
					note: orderId ? `Redeemed for order ${orderId}` : "Redeemed",
					createdAt: new Date(),
				};

				await transaction.upsert(
					"giftCardTransaction",
					txn.id,
					txn as Record<string, unknown>,
				);

				return { transaction: txn, giftCard: updatedCard };
			};

			if (transactions) {
				return transactions.transaction(async (transaction) => {
					if (!supportsRowLock(transaction)) return null;
					return redeemLocked(transaction);
				});
			}

			return redeemLocked({
				getForUpdate: data.get.bind(data),
				upsert: data.upsert.bind(data),
			});
		},

		async credit(
			id: string,
			amount: number,
			note?: string | undefined,
			orderId?: string | undefined,
		): Promise<RedeemResult | null> {
			const existing = await data.get("giftCard", id);
			if (!existing) return null;
			if (amount <= 0) return null;

			const card = existing as unknown as GiftCard;
			const newBalance = card.currentBalance + amount;

			const updatedCard: GiftCard = {
				...card,
				currentBalance: newBalance,
				status: newBalance > 0 ? "active" : card.status,
				updatedAt: new Date(),
			};

			await data.upsert("giftCard", id, updatedCard as Record<string, unknown>);

			const txnId = crypto.randomUUID();
			const txn: GiftCardTransaction = {
				id: txnId,
				giftCardId: id,
				type: "credit",
				amount,
				balanceAfter: newBalance,
				orderId,
				note: note ?? "Credit applied",
				createdAt: new Date(),
			};

			await data.upsert(
				"giftCardTransaction",
				txnId,
				txn as Record<string, unknown>,
			);

			return { transaction: txn, giftCard: updatedCard };
		},

		async listTransactions(giftCardId, params): Promise<GiftCardTransaction[]> {
			const results = await data.findMany("giftCardTransaction", {
				where: { giftCardId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as GiftCardTransaction[];
		},

		async countAll(): Promise<number> {
			const all = await data.findMany("giftCard", {});
			return (all as unknown as GiftCard[]).length;
		},

		async purchase(params: PurchaseGiftCardParams): Promise<GiftCard> {
			const card = await this.create({
				initialBalance: params.amount,
				currency: params.currency,
				purchasedByCustomerId: params.customerId,
				senderEmail: params.customerEmail,
				senderName: params.senderName,
				recipientEmail: params.recipientEmail,
				recipientName: params.recipientName,
				message: params.message,
				deliveryMethod: params.deliveryMethod ?? "digital",
				scheduledDeliveryAt: params.scheduledDeliveryAt,
				// If buying for self, assign to own customer ID
				customerId: params.recipientEmail ? undefined : params.customerId,
			});

			// Record purchase transaction
			const txnId = crypto.randomUUID();
			const txn: GiftCardTransaction = {
				id: txnId,
				giftCardId: card.id,
				type: "purchase",
				amount: params.amount,
				balanceAfter: params.amount,
				customerId: params.customerId,
				note: params.recipientEmail
					? `Gift card purchased for ${params.recipientEmail}`
					: "Gift card purchased for self",
				createdAt: new Date(),
			};

			await data.upsert(
				"giftCardTransaction",
				txnId,
				txn as Record<string, unknown>,
			);

			return card;
		},

		async topUp(params: TopUpParams): Promise<RedeemResult | null> {
			const existing = await data.get("giftCard", params.giftCardId);
			if (!existing) return null;

			const card = existing as unknown as GiftCard;

			// Customer can only top up their own cards
			if (card.customerId !== params.customerId) return null;
			if (card.status === "disabled") return null;
			if (params.amount <= 0) return null;

			const newBalance = card.currentBalance + params.amount;

			const updatedCard: GiftCard = {
				...card,
				currentBalance: newBalance,
				status: "active",
				updatedAt: new Date(),
			};

			await data.upsert(
				"giftCard",
				params.giftCardId,
				updatedCard as Record<string, unknown>,
			);

			const txnId = crypto.randomUUID();
			const txn: GiftCardTransaction = {
				id: txnId,
				giftCardId: params.giftCardId,
				type: "topup",
				amount: params.amount,
				balanceAfter: newBalance,
				customerId: params.customerId,
				note: "Balance top-up",
				createdAt: new Date(),
			};

			await data.upsert(
				"giftCardTransaction",
				txnId,
				txn as Record<string, unknown>,
			);

			return { transaction: txn, giftCard: updatedCard };
		},

		async sendGiftCard(params: SendGiftCardParams): Promise<GiftCard | null> {
			const existing = await data.get("giftCard", params.giftCardId);
			if (!existing) return null;

			const card = existing as unknown as GiftCard;

			// Only the owner or purchaser can send the card
			if (
				card.customerId !== params.customerId &&
				card.purchasedByCustomerId !== params.customerId
			) {
				return null;
			}

			// Card must be active
			if (card.status !== "active") return null;

			// Already delivered to someone else
			if (card.delivered && card.recipientEmail) return null;

			const now = new Date();
			const updated: GiftCard = {
				...card,
				recipientEmail: params.recipientEmail,
				recipientName: params.recipientName,
				senderName: params.senderName,
				message: params.message,
				deliveryMethod: "email",
				delivered: true,
				deliveredAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"giftCard",
				card.id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async listByCustomer(customerId, params): Promise<GiftCard[]> {
			// Find cards owned by this customer
			const owned = await data.findMany("giftCard", {
				where: { customerId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});

			return owned as unknown as GiftCard[];
		},

		async bulkCreate(params: BulkCreateParams): Promise<GiftCard[]> {
			const cards: GiftCard[] = [];
			for (let i = 0; i < params.count; i++) {
				const card = await this.create({
					initialBalance: params.initialBalance,
					currency: params.currency,
					expiresAt: params.expiresAt,
					note: params.note,
				});
				cards.push(card);
			}
			return cards;
		},

		async getStats(): Promise<GiftCardStats> {
			const allCards = (await data.findMany(
				"giftCard",
				{},
			)) as unknown as GiftCard[];

			let totalActive = 0;
			let totalDepleted = 0;
			let totalDisabled = 0;
			let totalExpired = 0;
			let totalIssuedValue = 0;
			let totalOutstandingBalance = 0;

			const now = new Date();
			for (const card of allCards) {
				totalIssuedValue += card.initialBalance;
				totalOutstandingBalance += card.currentBalance;

				// Count expired cards (expiresAt in the past) regardless of stored status
				if (card.expiresAt && new Date(card.expiresAt) < now) {
					totalExpired++;
				} else if (card.status === "depleted") {
					totalDepleted++;
				} else if (card.status === "disabled") {
					totalDisabled++;
				} else {
					totalActive++;
				}
			}

			// Calculate redeemed value from transactions
			const allTxns = (await data.findMany(
				"giftCardTransaction",
				{},
			)) as unknown as GiftCardTransaction[];

			let totalRedeemedValue = 0;
			for (const txn of allTxns) {
				if (txn.type === "debit") {
					totalRedeemedValue += txn.amount;
				}
			}

			return {
				totalIssued: allCards.length,
				totalActive,
				totalDepleted,
				totalDisabled,
				totalExpired,
				totalIssuedValue,
				totalRedeemedValue,
				totalOutstandingBalance,
			};
		},

		async disableExpired(): Promise<number> {
			const allCards = (await data.findMany(
				"giftCard",
				{},
			)) as unknown as GiftCard[];

			const now = new Date();
			let count = 0;

			for (const card of allCards) {
				if (
					card.expiresAt &&
					new Date(card.expiresAt) < now &&
					card.status === "active"
				) {
					await this.update(card.id, { status: "expired" });
					count++;
				}
			}

			return count;
		},
	};
}
