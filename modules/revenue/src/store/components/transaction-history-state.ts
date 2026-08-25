import type { PaymentIntentStatus } from "../../service";

const PAYMENT_INTENT_STATUSES: readonly PaymentIntentStatus[] = [
	"pending",
	"processing",
	"succeeded",
	"failed",
	"cancelled",
	"refunded",
];
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

export type TransactionHistoryRecord = {
	id: string;
	providerIntentId?: string | undefined;
	orderId?: string | undefined;
	amount: number;
	currency: string;
	status: PaymentIntentStatus;
	createdAt: string;
	updatedAt: string;
};

export type TransactionHistoryPage = {
	transactions: TransactionHistoryRecord[];
	total: number;
};

type TransactionHistoryQuery = Readonly<{
	data: unknown;
	isError: boolean;
	isLoading: boolean;
}>;

type TransactionHistoryQueryResult =
	| Readonly<{ status: "loading" }>
	| Readonly<{ status: "unauthenticated" }>
	| Readonly<{ status: "unavailable" }>
	| Readonly<{ data: TransactionHistoryPage; status: "ready" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || typeof value === "string";
}

function isTransactionHistoryRecord(
	value: unknown,
): value is TransactionHistoryRecord {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		isOptionalString(value.providerIntentId) &&
		isOptionalString(value.orderId) &&
		typeof value.amount === "number" &&
		Number.isFinite(value.amount) &&
		typeof value.currency === "string" &&
		CURRENCY_CODE.test(value.currency) &&
		PAYMENT_INTENT_STATUSES.includes(value.status as PaymentIntentStatus) &&
		typeof value.createdAt === "string" &&
		Number.isFinite(Date.parse(value.createdAt)) &&
		typeof value.updatedAt === "string" &&
		Number.isFinite(Date.parse(value.updatedAt))
	);
}

function isTransactionHistoryPage(
	value: unknown,
): value is TransactionHistoryPage {
	return (
		isRecord(value) &&
		Array.isArray(value.transactions) &&
		value.transactions.every(isTransactionHistoryRecord) &&
		typeof value.total === "number" &&
		Number.isInteger(value.total) &&
		value.total >= 0
	);
}

export function resolveTransactionHistoryQuery(
	query: TransactionHistoryQuery,
): TransactionHistoryQueryResult {
	if (query.isError) return { status: "unavailable" };
	if (query.isLoading) return { status: "loading" };
	if (isRecord(query.data) && query.data.status === 401) {
		return { status: "unauthenticated" };
	}
	if (!isTransactionHistoryPage(query.data)) return { status: "unavailable" };
	return { data: query.data, status: "ready" };
}
