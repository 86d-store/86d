import { defineConfig } from "drizzle-kit";
import { getProcessEnv } from "env/process-env";

export default defineConfig({
	dialect: "postgresql",
	schema: ["./src/schema/tables.ts", "./src/schema/core.ts"],
	out: "./drizzle",
	dbCredentials: {
		url:
			getProcessEnv("DATABASE_URL") ??
			"postgresql://postgres:postgres@localhost:5434/postgres",
	},
});
