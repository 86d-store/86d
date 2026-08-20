import type pg from "pg";
import type { ModuleDataRow } from "./backfill-module-tables";

export type MoneyPartyProposal = Readonly<{
	id: string;
	kind: "person" | "organization";
	displayName: string | null;
	email: string | null;
}>;

export type MoneySubjectProposal = Readonly<{
	id: string;
	kind: string;
	ownerModule: string;
	partyId: string;
	currency: string;
	expectedMinor: number;
	settleState: "open" | "settled" | "void";
	sourceModule: string;
	sourceEntityType: string;
	sourceEntityId: string;
}>;

export type MoneyTransactionProposal = Readonly<{
	id: string;
	subjectId: string;
	authorizedMinor: number;
	capturedMinor: number;
	refundedMinor: number;
	sourceModule: string;
	sourceEntityType: string;
	sourceEntityId: string;
}>;

export type MoneyDefect = Readonly<{
	code:
		| "subject_overrun"
		| "captured_exceeds_authorized"
		| "refunded_exceeds_captured"
		| "unnameable_subject";
	message: string;
	sourceModule: string;
	sourceEntityType: string;
	sourceEntityId: string;
}>;

export type MoneyInvariantSummary = Readonly<{
	defects: readonly MoneyDefect[];
	insertedParties: number;
	insertedSubjects: number;
	insertedTransactions: number;
}>;

function asRecord(value: unknown): Record<string, unknown> | null {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
}

function readNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function indexRows(
	rows: readonly ModuleDataRow[],
): ReadonlyMap<string, readonly ModuleDataRow[]> {
	const map = new Map<string, ModuleDataRow[]>();
	for (const row of rows) {
		const list = map.get(row.moduleName) ?? [];
		list.push(row);
		map.set(row.moduleName, list);
	}
	return map;
}

function findCustomer(
	customers: readonly ModuleDataRow[],
	customerId: string | null,
): MoneyPartyProposal | null {
	if (!customerId) {
		return null;
	}
	const row = customers.find(
		(entry) => entry.entityType === "customer" && entry.entityId === customerId,
	);
	const data = row ? asRecord(row.data) : null;
	return {
		id: customerId,
		kind: "person",
		displayName: data ? readString(data.name) : null,
		email: data ? readString(data.email) : null,
	};
}

export function proposeMoneyRows(rows: readonly ModuleDataRow[]): Readonly<{
	parties: readonly MoneyPartyProposal[];
	subjects: readonly MoneySubjectProposal[];
	transactions: readonly MoneyTransactionProposal[];
}> {
	const byModule = indexRows(rows);
	const orders = byModule.get("orders") ?? [];
	const payments = byModule.get("payments") ?? [];
	const customers = byModule.get("customers") ?? [];

	const parties = new Map<string, MoneyPartyProposal>();
	const subjects = new Map<string, MoneySubjectProposal>();
	const transactions: MoneyTransactionProposal[] = [];

	for (const row of orders) {
		if (row.entityType !== "order") {
			continue;
		}
		const data = asRecord(row.data);
		if (!data) {
			continue;
		}
		const customerId = readString(data.customerId);
		const party = findCustomer(customers, customerId);
		if (party) {
			parties.set(party.id, party);
		}
		const total = readNumber(data.total);
		const currency = readString(data.currency) ?? "USD";
		if (total === null) {
			continue;
		}
		subjects.set(row.entityId, {
			id: row.entityId,
			kind: "order",
			ownerModule: "orders",
			partyId: party?.id ?? row.entityId,
			currency,
			expectedMinor: total,
			settleState:
				readString(data.paymentStatus) === "paid" ? "settled" : "open",
			sourceModule: "orders",
			sourceEntityType: "order",
			sourceEntityId: row.entityId,
		});
	}

	for (const row of payments) {
		if (row.entityType === "paymentV2") {
			const data = asRecord(row.data);
			if (!data) {
				continue;
			}
			const orderId = readString(data.orderId);
			const checkoutId = readString(data.checkoutId);
			const subjectId = orderId ?? checkoutId;
			if (!subjectId) {
				continue;
			}
			const expectedMinor = readNumber(data.expectedAmount);
			const currency = readString(data.currency) ?? "USD";
			if (expectedMinor !== null) {
				subjects.set(subjectId, {
					id: subjectId,
					kind: orderId ? "order" : "checkout",
					ownerModule: orderId ? "orders" : "checkout",
					partyId: subjectId,
					currency,
					expectedMinor,
					settleState:
						readString(data.state) === "captured" ||
						readString(data.state) === "refunded"
							? "settled"
							: "open",
					sourceModule: "payments",
					sourceEntityType: "paymentV2",
					sourceEntityId: row.entityId,
				});
			}
			const authorizedMinor = readNumber(data.authorizedAmount) ?? 0;
			const capturedMinor = readNumber(data.capturedAmount) ?? 0;
			const refundedMinor = readNumber(data.confirmedRefundedAmount) ?? 0;
			transactions.push({
				id: row.entityId,
				subjectId,
				authorizedMinor,
				capturedMinor,
				refundedMinor,
				sourceModule: "payments",
				sourceEntityType: "paymentV2",
				sourceEntityId: row.entityId,
			});
			continue;
		}

		if (row.entityType === "paymentIntent") {
			const data = asRecord(row.data);
			if (!data) {
				continue;
			}
			const orderId = readString(data.orderId);
			const customerId = readString(data.customerId);
			if (!orderId) {
				continue;
			}
			const party = findCustomer(customers, customerId);
			if (party) {
				parties.set(party.id, party);
			}
			const amount = readNumber(data.amount);
			const currency = readString(data.currency) ?? "USD";
			if (amount === null) {
				continue;
			}
			if (!subjects.has(orderId)) {
				subjects.set(orderId, {
					id: orderId,
					kind: "order",
					ownerModule: "orders",
					partyId: party?.id ?? orderId,
					currency,
					expectedMinor: amount,
					settleState:
						readString(data.status) === "succeeded" ? "settled" : "open",
					sourceModule: "payments",
					sourceEntityType: "paymentIntent",
					sourceEntityId: row.entityId,
				});
			}
			const succeeded = readString(data.status) === "succeeded";
			transactions.push({
				id: row.entityId,
				subjectId: orderId,
				authorizedMinor: amount,
				capturedMinor: succeeded ? amount : 0,
				refundedMinor: 0,
				sourceModule: "payments",
				sourceEntityType: "paymentIntent",
				sourceEntityId: row.entityId,
			});
		}
	}

	return {
		parties: [...parties.values()],
		subjects: [...subjects.values()],
		transactions,
	};
}

export function analyzeMoneyInvariant(
	rows: readonly ModuleDataRow[],
): MoneyInvariantSummary {
	const proposals = proposeMoneyRows(rows);
	const defects: MoneyDefect[] = [];

	const capturedBySubject = new Map<string, number>();
	for (const transaction of proposals.transactions) {
		const current = capturedBySubject.get(transaction.subjectId) ?? 0;
		capturedBySubject.set(
			transaction.subjectId,
			current + transaction.capturedMinor,
		);

		if (transaction.capturedMinor > transaction.authorizedMinor) {
			defects.push({
				code: "captured_exceeds_authorized",
				message: `captured_minor ${transaction.capturedMinor} exceeds authorized_minor ${transaction.authorizedMinor}`,
				sourceModule: transaction.sourceModule,
				sourceEntityType: transaction.sourceEntityType,
				sourceEntityId: transaction.sourceEntityId,
			});
		}
		if (transaction.refundedMinor > transaction.capturedMinor) {
			defects.push({
				code: "refunded_exceeds_captured",
				message: `refunded_minor ${transaction.refundedMinor} exceeds captured_minor ${transaction.capturedMinor}`,
				sourceModule: transaction.sourceModule,
				sourceEntityType: transaction.sourceEntityType,
				sourceEntityId: transaction.sourceEntityId,
			});
		}
	}

	for (const subject of proposals.subjects) {
		const capturedTotal = capturedBySubject.get(subject.id) ?? 0;
		if (capturedTotal > subject.expectedMinor) {
			defects.push({
				code: "subject_overrun",
				message: `sum(captured_minor)=${capturedTotal} exceeds expected_minor=${subject.expectedMinor}`,
				sourceModule: subject.sourceModule,
				sourceEntityType: subject.sourceEntityType,
				sourceEntityId: subject.sourceEntityId,
			});
		}
	}

	const paymentRows = rows.filter((row) => row.moduleName === "payments");
	for (const row of paymentRows) {
		if (row.entityType !== "paymentV2" && row.entityType !== "paymentIntent") {
			continue;
		}
		const data = asRecord(row.data);
		if (!data) {
			continue;
		}
		const hasAnchor =
			readString(data.orderId) !== null ||
			readString(data.checkoutId) !== null ||
			readString(data.customerId) !== null;
		if (!hasAnchor) {
			defects.push({
				code: "unnameable_subject",
				message: "money row cannot name a Subject without guessing",
				sourceModule: "payments",
				sourceEntityType: row.entityType,
				sourceEntityId: row.entityId,
			});
		}
	}

	const validTransactions = proposals.transactions.filter((transaction) => {
		return (
			transaction.capturedMinor <= transaction.authorizedMinor &&
			transaction.refundedMinor <= transaction.capturedMinor
		);
	});

	const subjectOverruns = new Set(
		defects
			.filter((defect) => defect.code === "subject_overrun")
			.map((defect) => defect.sourceEntityId),
	);

	let insertedParties = 0;
	let insertedSubjects = 0;
	let insertedTransactions = 0;

	insertedParties = proposals.parties.length;
	for (const subject of proposals.subjects) {
		if (!subjectOverruns.has(subject.id)) {
			insertedSubjects += 1;
		}
	}
	for (const transaction of validTransactions) {
		const subject = proposals.subjects.find(
			(entry) => entry.id === transaction.subjectId,
		);
		if (!subject) {
			continue;
		}
		const capturedTotal = capturedBySubject.get(subject.id) ?? 0;
		if (capturedTotal <= subject.expectedMinor) {
			insertedTransactions += 1;
		}
	}

	defects.sort((a, b) =>
		`${a.code}:${a.sourceEntityId}`.localeCompare(
			`${b.code}:${b.sourceEntityId}`,
		),
	);

	return {
		defects,
		insertedParties,
		insertedSubjects,
		insertedTransactions,
	};
}

export function formatMoneyDefect(defect: MoneyDefect): string {
	return `DEFECT code=${defect.code} module=${defect.sourceModule} entityType=${defect.sourceEntityType} entityId=${defect.sourceEntityId} message=${defect.message}`;
}

export function printMoneyReport(summary: MoneyInvariantSummary): void {
	console.log(`Money report: defects=${summary.defects.length}`);
	console.log(
		`Proposed inserts: parties=${summary.insertedParties} subjects=${summary.insertedSubjects} transactions=${summary.insertedTransactions}`,
	);
	for (const defect of summary.defects) {
		console.log(formatMoneyDefect(defect));
	}
}

async function fetchMoneyRows(pool: pg.Pool): Promise<ModuleDataRow[]> {
	const result = await pool.query<{
		moduleName: string;
		entityType: string;
		entityId: string;
		data: unknown;
	}>(
		`SELECT m.name AS "moduleName", md."entityType", md."entityId", md.data
     FROM "ModuleData" md
     JOIN "Module" m ON m.id = md."moduleId"
     WHERE m.name IN ('orders', 'payments', 'customers', 'checkout')
     ORDER BY m.name, md."entityType", md."entityId"`,
	);
	return result.rows;
}

export async function runMoneyReport(
	pool: pg.Pool,
): Promise<MoneyInvariantSummary> {
	const rows = await fetchMoneyRows(pool);
	const summary = analyzeMoneyInvariant(rows);
	printMoneyReport(summary);
	return summary;
}
