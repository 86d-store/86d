import type { PaymentIntentStatus, RevenueStats } from "../../service";

const STATUS_KEYS: readonly PaymentIntentStatus[] = [
	"pending",
	"processing",
	"succeeded",
	"failed",
	"cancelled",
	"refunded",
];
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isFormatSafeCurrency(value: unknown): value is string {
	return typeof value === "string" && CURRENCY_CODE.test(value);
}

type RevenueQuery = Readonly<{
	data: unknown;
	isError: boolean;
	isLoading: boolean;
}>;

type RevenueQueryResult<T> =
	| Readonly<{ status: "loading" }>
	| Readonly<{ status: "unavailable" }>
	| Readonly<{ data: T; status: "ready" }>;

export function resolveRevenueQuery<T>(
	query: RevenueQuery,
	isAuthoritative: (value: unknown) => value is T,
): RevenueQueryResult<T> {
	if (query.isError) return { status: "unavailable" };
	if (query.isLoading) return { status: "loading" };
	if (!isAuthoritative(query.data)) return { status: "unavailable" };
	return { data: query.data, status: "ready" };
}

export function isRevenueStats(value: unknown): value is RevenueStats {
	if (!isRecord(value)) return false;
	const { byStatus } = value;
	if (!isRecord(byStatus)) return false;
	return (
		isFiniteNumber(value.totalVolume) &&
		isFiniteNumber(value.transactionCount) &&
		isFiniteNumber(value.averageValue) &&
		isFormatSafeCurrency(value.currency) &&
		isFiniteNumber(value.refundVolume) &&
		isFiniteNumber(value.refundCount) &&
		STATUS_KEYS.every((status) => isFiniteNumber(byStatus[status]))
	);
}

export type RevenueTransactionRecord = {
	id: string;
	providerIntentId?: string | null;
	email?: string | null;
	customerId?: string | null;
	orderId?: string | null;
	amount: number;
	currency: string;
	status: PaymentIntentStatus;
	createdAt: string;
	updatedAt: string;
};

export type RevenueTransactionPage = {
	transactions: RevenueTransactionRecord[];
	total: number;
};

function isNullableString(value: unknown): value is string | null | undefined {
	return value === undefined || value === null || typeof value === "string";
}

function isRevenueTransaction(
	value: unknown,
): value is RevenueTransactionRecord {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		isNullableString(value.providerIntentId) &&
		isNullableString(value.email) &&
		isNullableString(value.customerId) &&
		isNullableString(value.orderId) &&
		isFiniteNumber(value.amount) &&
		isFormatSafeCurrency(value.currency) &&
		STATUS_KEYS.includes(value.status as PaymentIntentStatus) &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string"
	);
}

export function isRevenueTransactionPage(
	value: unknown,
): value is RevenueTransactionPage {
	return (
		isRecord(value) &&
		Array.isArray(value.transactions) &&
		value.transactions.every(isRevenueTransaction) &&
		isFiniteNumber(value.total)
	);
}

export function isRevenueExportResult(
	value: unknown,
): value is { csv: string; count: number } {
	return (
		isRecord(value) &&
		typeof value.csv === "string" &&
		isFiniteNumber(value.count)
	);
}
