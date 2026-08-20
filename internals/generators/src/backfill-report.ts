#!/usr/bin/env tsx

import pg from "pg";
import { runBackfillReport } from "../../../packages/db/src/backfill-module-tables.ts";

async function main() {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		console.error(
			"DATABASE_URL is required. Use a disposable local database only.",
		);
		process.exit(1);
	}
	const pool = new pg.Pool({ connectionString });
	try {
		await runBackfillReport(pool);
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
