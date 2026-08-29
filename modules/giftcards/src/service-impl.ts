import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	giftcardsGiftCardShape,
	giftcardsGiftCardTransactionShape,
} from "./schema";
import type {
	GiftCard,
	GiftCardAdminListParams,
	GiftCardAdminSortField,
	GiftCardController,
	GiftCardStats,
	GiftCardTransaction,
	SendGiftCardParams,
} from "./service";

const READ_BATCH_SIZE = 1_000;

const giftCardSearchDateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

const giftCardTextCollator = new Intl.Collator("en-US", {
	numeric: true,
	sensitivity: "base",
});

export class GiftCardDataUnavailableError extends Error {
	constructor() {
		super("Gift card data is unavailable.");
		this.name = "GiftCardDataUnavailableError";
	}
}

function parseGiftCard(value: unknown): GiftCard | null {
	if (value === null || value === undefined) return null;
	const parsed = giftcardsGiftCardShape.safeParse(value);
	if (!parsed.success) throw new GiftCardDataUnavailableError();
	return parsed.data;
}

function parseGiftCardTransaction(value: unknown): GiftCardTransaction | null {
	if (value === null || value === undefined) return null;
	const parsed = giftcardsGiftCardTransactionShape.safeParse(value);
	if (!parsed.success) throw new GiftCardDataUnavailableError();
	return parsed.data;
}

function parseGiftCards(values: readonly unknown[]): GiftCard[] {
	return values.map((value) => {
		const card = parseGiftCard(value);
		if (!card) throw new GiftCardDataUnavailableError();
		return card;
	});
}

function parseGiftCardTransactions(
	values: readonly unknown[],
): GiftCardTransaction[] {
	return values.map((value) => {
		const transaction = parseGiftCardTransaction(value);
		if (!transaction) throw new GiftCardDataUnavailableError();
		return transaction;
	});
}

function hasGiftCardExpired(card: GiftCard, now: Date): boolean {
	if (card.status === "expired") return true;
	if (!card.expiresAt) return false;
	const expiresAt = Date.parse(card.expiresAt);
	return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

function projectEffectiveGiftCardStatus(card: GiftCard, now: Date): GiftCard {
	if (!hasGiftCardExpired(card, now) || card.status === "expired") return card;
	return { ...card, status: "expired" };
}

function projectEffectiveGiftCardStatuses(
	cards: readonly GiftCard[],
	now: Date,
): GiftCard[] {
	return cards.map((card) => projectEffectiveGiftCardStatus(card, now));
}

function supportsRowLock(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

async function findAllRows(
	data: ModuleDataService,
	entityType: "giftCard" | "giftCardTransaction",
	where?: Record<string, unknown> | undefined,
): Promise<unknown[]> {
	const rows: unknown[] = [];
	let skip = 0;
	let batch: unknown[];

	do {
		batch = await data.findMany(entityType, {
			...(where && Object.keys(where).length > 0 ? { where } : {}),
			orderBy: { id: "asc" },
			take: READ_BATCH_SIZE,
			skip,
		});
		rows.push(...batch);
		skip += batch.length;
	} while (batch.length === READ_BATCH_SIZE);

	return rows;
}

async function findAllGiftCards(
	data: ModuleDataService,
	where?: Record<string, unknown> | undefined,
): Promise<GiftCard[]> {
	return parseGiftCards(await findAllRows(data, "giftCard", where));
}

async function findAllGiftCardTransactions(
	data: ModuleDataService,
): Promise<GiftCardTransaction[]> {
	return parseGiftCardTransactions(
		await findAllRows(data, "giftCardTransaction"),
	);
}

function matchesAdminSearch(card: GiftCard, search: string): boolean {
	const query = search.trim().toLocaleLowerCase("en-US");
	if (!query) return true;

	return [
		card.code,
		card.recipientEmail,
		card.recipientName,
		card.status,
		card.createdAt.toISOString(),
		giftCardSearchDateFormatter.format(card.createdAt),
	].some((value) => value?.toLocaleLowerCase("en-US").includes(query));
}

function compareAdminField(
	left: GiftCard,
	right: GiftCard,
	sort: GiftCardAdminSortField,
): number {
	if (sort === "balance") {
		return left.currentBalance - right.currentBalance;
	}
	if (sort === "createdAt") {
		return left.createdAt.getTime() - right.createdAt.getTime();
	}
	if (sort === "recipient") {
		return giftCardTextCollator.compare(
			left.recipientEmail ?? "",
			right.recipientEmail ?? "",
		);
	}
	return giftCardTextCollator.compare(left[sort], right[sort]);
}

function sortAdminCards(
	cards: GiftCard[],
	params: GiftCardAdminListParams | undefined,
): GiftCard[] {
	const sort = params?.sort ?? "createdAt";
	const multiplier = params?.direction === "asc" ? 1 : -1;

	return [...cards].sort((left, right) => {
		const compared = compareAdminField(left, right, sort);
		if (compared !== 0) return compared * multiplier;
		return giftCardTextCollator.compare(left.id, right.id);
	});
}

export function createGiftCardController(
	data: ModuleDataService,
	transactions?: ModuleTransactionRunner | undefined,
): GiftCardController {
	return {
		async get(id: string): Promise<GiftCard | null> {
			const card = parseGiftCard(await data.get("giftCard", id));
			return card ? projectEffectiveGiftCardStatus(card, new Date()) : null;
		},

		async getByCode(code: string): Promise<GiftCard | null> {
			const results = await data.findMany("giftCard", {
				where: { code: code.toUpperCase() },
				take: 1,
			});
			const card = parseGiftCard(results[0]);
			return card ? projectEffectiveGiftCardStatus(card, new Date()) : null;
		},

		async list(params): Promise<GiftCard[]> {
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;

			const cards = projectEffectiveGiftCardStatuses(
				await findAllGiftCards(data, where),
				new Date(),
			).filter((card) =>
				params?.status ? card.status === params.status : true,
			);
			const skip = params?.skip ?? 0;
			return cards.slice(
				skip,
				params?.take !== undefined ? skip + params.take : undefined,
			);
		},

		async listAdminPage(params): Promise<{
			cards: GiftCard[];
			total: number;
		}> {
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;

			const cards = projectEffectiveGiftCardStatuses(
				await findAllGiftCards(data, where),
				new Date(),
			);
			const matching = cards.filter(
				(card) =>
					(!params?.status || card.status === params.status) &&
					(!params?.search || matchesAdminSearch(card, params.search)),
			);
			const sorted = sortAdminCards(matching, params);
			const skip = params?.skip ?? 0;
			const take = params?.take ?? 50;

			return {
				cards: sorted.slice(skip, skip + take),
				total: sorted.length,
			};
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
			const parsedCard = parseGiftCard(results[0]);
			if (!parsedCard) return null;
			const card = projectEffectiveGiftCardStatus(parsedCard, new Date());

			if (card.status === "expired") {
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

		async listTransactions(giftCardId, params): Promise<GiftCardTransaction[]> {
			const results = await data.findMany("giftCardTransaction", {
				where: { giftCardId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return parseGiftCardTransactions(results);
		},

		async countAll(): Promise<number> {
			return (await findAllGiftCards(data)).length;
		},

		async sendGiftCard(params: SendGiftCardParams): Promise<GiftCard | null> {
			if (!transactions) return null;

			return transactions.transaction(async (transaction) => {
				if (!supportsRowLock(transaction)) return null;
				const card = parseGiftCard(
					await transaction.getForUpdate("giftCard", params.giftCardId),
				);
				if (!card) return null;

				if (
					card.customerId !== params.customerId &&
					card.purchasedByCustomerId !== params.customerId
				) {
					return null;
				}
				if (card.status !== "active") return null;
				if (
					card.delivered === true ||
					[
						card.recipientEmail,
						card.recipientName,
						card.senderName,
						card.senderEmail,
						card.message,
						card.deliveryMethod,
						card.deliveredAt,
						card.scheduledDeliveryAt,
					].some((marker) => marker !== undefined)
				) {
					return null;
				}

				const now = new Date();
				if (card.expiresAt) {
					const expiresAt = Date.parse(card.expiresAt);
					if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
						return null;
					}
				}
				const updated: GiftCard = {
					...card,
					recipientEmail: params.recipientEmail,
					recipientName: params.recipientName,
					senderName: params.senderName,
					message: params.message,
					deliveryMethod: "email",
					updatedAt: now,
				};

				await transaction.upsert("giftCard", card.id, { ...updated });
				return updated;
			});
		},

		async listByCustomer(customerId, params): Promise<GiftCard[]> {
			const results = await data.findMany("giftCard", {
				where: { customerId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return projectEffectiveGiftCardStatuses(
				parseGiftCards(results),
				new Date(),
			);
		},

		async getStats(): Promise<GiftCardStats> {
			const now = new Date();
			const allCards = projectEffectiveGiftCardStatuses(
				await findAllGiftCards(data),
				now,
			);

			let totalActive = 0;
			let totalDepleted = 0;
			let totalDisabled = 0;
			let totalExpired = 0;
			let totalIssuedValue = 0;
			let totalOutstandingBalance = 0;
			for (const card of allCards) {
				totalIssuedValue += card.initialBalance;
				totalOutstandingBalance += card.currentBalance;

				if (card.status === "expired") {
					totalExpired++;
				} else if (card.status === "depleted") {
					totalDepleted++;
				} else if (card.status === "disabled") {
					totalDisabled++;
				} else if (card.status === "active") {
					totalActive++;
				}
			}

			const allTransactions = await findAllGiftCardTransactions(data);
			const totalRedeemedValue = allTransactions.reduce(
				(total, transaction) =>
					transaction.type === "debit" ? total + transaction.amount : total,
				0,
			);

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
	};
}
