import { Prisma, PrismaClient } from "@86d-app/core/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClientInstance | undefined;
};

function createClient(): PrismaClientInstance {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("DATABASE_URL environment variable is required");
	}
	const adapter = new PrismaPg({ connectionString });
	return new PrismaClient({ adapter });
}

function getClient(): PrismaClientInstance {
	if (!globalForPrisma.prisma) {
		globalForPrisma.prisma = createClient();
	}
	return globalForPrisma.prisma;
}

/**
 * Lazy-initialized Prisma client.
 * The connection is created on first property access, not at import time.
 * This allows the store app to build without DATABASE_URL.
 */
export const db: PrismaClientInstance = new Proxy({} as PrismaClientInstance, {
	get(_target, prop) {
		const client = getClient();
		const value = Reflect.get(client, prop, client);
		if (typeof value === "function") {
			return (value as (...args: Array<unknown>) => unknown).bind(client);
		}
		return value;
	},
});

export { Prisma };
