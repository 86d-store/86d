import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { transaction as coreTransaction, party, subject } from "./schema/core";

export type CorePartyInput = Readonly<{
	id: string;
	kind: "person" | "organization";
	displayName?: string | null;
	email?: string | null;
}>;

export type CoreSubjectInput = Readonly<{
	id: string;
	kind: string;
	ownerModule: string;
	partyId: string;
	currency: string;
	expectedMinor: number;
	settleState: "open" | "settled" | "void";
}>;

export type CoreTransactionInput = Readonly<{
	id: string;
	subjectId: string;
	authorizedMinor: number;
	capturedMinor?: number;
	refundedMinor?: number;
}>;

/** Insert or update core.party / core.subject / core.transaction for money owners. */
export async function writeCoreMoney<TSchema extends Record<string, unknown>>(
	db: NodePgDatabase<TSchema>,
	input: Readonly<{
		party: CorePartyInput;
		subject: CoreSubjectInput;
		transaction: CoreTransactionInput;
	}>,
): Promise<void> {
	await db
		.insert(party)
		.values({
			id: input.party.id,
			kind: input.party.kind,
			displayName: input.party.displayName ?? null,
			email: input.party.email ?? null,
		})
		.onConflictDoUpdate({
			target: party.id,
			set: {
				kind: input.party.kind,
				displayName: input.party.displayName ?? null,
				email: input.party.email ?? null,
				updatedAt: sql`CURRENT_TIMESTAMP`,
			},
		});

	await db
		.insert(subject)
		.values({
			id: input.subject.id,
			kind: input.subject.kind,
			ownerModule: input.subject.ownerModule,
			partyId: input.subject.partyId,
			currency: input.subject.currency,
			expectedMinor: input.subject.expectedMinor,
			settleState: input.subject.settleState,
		})
		.onConflictDoUpdate({
			target: subject.id,
			set: {
				kind: input.subject.kind,
				ownerModule: input.subject.ownerModule,
				partyId: input.subject.partyId,
				currency: input.subject.currency,
				expectedMinor: input.subject.expectedMinor,
				settleState: input.subject.settleState,
				updatedAt: sql`CURRENT_TIMESTAMP`,
			},
		});

	await db
		.insert(coreTransaction)
		.values({
			id: input.transaction.id,
			subjectId: input.transaction.subjectId,
			authorizedMinor: input.transaction.authorizedMinor,
			capturedMinor: input.transaction.capturedMinor ?? 0,
			refundedMinor: input.transaction.refundedMinor ?? 0,
		})
		.onConflictDoUpdate({
			target: coreTransaction.id,
			set: {
				subjectId: input.transaction.subjectId,
				authorizedMinor: input.transaction.authorizedMinor,
				capturedMinor: input.transaction.capturedMinor ?? 0,
				refundedMinor: input.transaction.refundedMinor ?? 0,
				updatedAt: sql`CURRENT_TIMESTAMP`,
			},
		});
}
