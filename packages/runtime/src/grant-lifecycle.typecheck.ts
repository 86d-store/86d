import type { Prisma, PrismaClient } from "@86d-app/core/prisma";
import type {
	PrismaConfirmationIssueClient,
	PrismaConfirmationIssueTransaction,
} from "./confirmation-issuer";
import type {
	PrismaGrantAdministrationClient,
	PrismaGrantAdministrationTransaction,
} from "./grant-administration";

type ConfirmationTransactionIsCompatible =
	Prisma.TransactionClient extends PrismaConfirmationIssueTransaction
		? true
		: false;
type ConfirmationClientIsCompatible =
	PrismaClient extends PrismaConfirmationIssueClient<Prisma.TransactionClient>
		? true
		: false;
type AdministrationTransactionIsCompatible =
	Prisma.TransactionClient extends PrismaGrantAdministrationTransaction
		? true
		: false;
type AdministrationClientIsCompatible =
	PrismaClient extends PrismaGrantAdministrationClient<Prisma.TransactionClient>
		? true
		: false;

type Assert<T extends true> = T;

export type GeneratedPrismaConfirmationTransactionCompatibility =
	Assert<ConfirmationTransactionIsCompatible>;
export type GeneratedPrismaConfirmationClientCompatibility =
	Assert<ConfirmationClientIsCompatible>;
export type GeneratedPrismaGrantAdministrationTransactionCompatibility =
	Assert<AdministrationTransactionIsCompatible>;
export type GeneratedPrismaGrantAdministrationClientCompatibility =
	Assert<AdministrationClientIsCompatible>;
