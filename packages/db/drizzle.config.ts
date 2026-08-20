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
});
