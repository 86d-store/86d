import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: ["./src/schema/tables.ts", "./src/schema/core.ts"],
	out: "./drizzle",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ??
			"postgresql://postgres:postgres@localhost:5434/postgres",
	},
	// Prisma's bookkeeping table is not part of the Store schema.
	tablesFilter: ["!_prisma_migrations"],
});
