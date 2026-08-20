import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma",
	migrations: {
		path: "prisma/migrations",
		seed: "tsx src/seed.ts",
	},
	datasource: {
		url:
			process.env.DATABASE_URL ||
			"postgresql://postgres:postgres@localhost:5434/postgres",
	},
});
