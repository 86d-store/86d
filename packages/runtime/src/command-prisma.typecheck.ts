import type { Prisma, PrismaClient } from "@86d-app/core/prisma";
import type {
	PrismaCommandClient,
	PrismaCommandTransaction,
} from "./command-prisma";

type TransactionIsCompatible =
	Prisma.TransactionClient extends PrismaCommandTransaction ? true : false;

type ClientIsCompatible =
	PrismaClient extends PrismaCommandClient<Prisma.TransactionClient>
		? true
		: false;

type Assert<T extends true> = T;

/** Compile-time proofs that the generated Store client satisfies the adapter. */
export type GeneratedPrismaTransactionCompatibility =
	Assert<TransactionIsCompatible>;
export type GeneratedPrismaCommandClientCompatibility =
	Assert<ClientIsCompatible>;
