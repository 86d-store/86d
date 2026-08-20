import type { Module } from "../../types/module";
import type { TableDeclaration } from "../declaration";
import { compileTableShape } from "./analyze-zod";
import type { CompileModuleResult, CompileReport } from "./types";

function wrapIdempotentConstraint(statement: string): string {
	const trimmed = statement.trim().replace(/;$/, "");
	return `DO $$ BEGIN
  ${trimmed};
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`;
}

/** Emit Postgres DDL for compiled tables (report mode — SQL strings only). */
export function emitSql(tables: readonly CompileModuleResult[]): string {
	const lines: string[] = [];
	const seenSchemas = new Set<string>();

	for (const moduleResult of tables) {
		for (const table of moduleResult.tables) {
			if (!seenSchemas.has(table.schemaName)) {
				lines.push(`CREATE SCHEMA IF NOT EXISTS "${table.schemaName}";`);
				seenSchemas.add(table.schemaName);
			}

			const columnDefs = table.columns.map((column) => {
				const nullSql = column.nullable ? "" : " NOT NULL";
				return `"${column.name}" ${column.sqlType}${nullSql}`;
			});

			if (table.primaryKey.length > 0) {
				const pkCols = table.primaryKey.map((c) => `"${c}"`).join(", ");
				columnDefs.push(`PRIMARY KEY (${pkCols})`);
			}

			for (const column of table.columns) {
				for (const check of column.checkConstraints) {
					columnDefs.push(`CHECK (${check})`);
				}
			}

			lines.push(
				`CREATE TABLE IF NOT EXISTS "${table.schemaName}"."${table.tableName}" (`,
			);
			lines.push(`  ${columnDefs.join(",\n  ")}`);
			lines.push(");");

			for (const unique of table.uniqueConstraints) {
				const cols = unique.map((c) => `"${c}"`).join(", ");
				lines.push(
					`CREATE UNIQUE INDEX IF NOT EXISTS "${table.tableName}_${unique.join("_")}_unique" ON "${table.schemaName}"."${table.tableName}" (${cols});`,
				);
			}

			for (const index of table.indexes) {
				const cols = index.map((c) => `"${c}"`).join(", ");
				lines.push(
					`CREATE INDEX IF NOT EXISTS "${table.tableName}_${index.join("_")}_idx" ON "${table.schemaName}"."${table.tableName}" (${cols});`,
				);
			}

			for (const fk of table.foreignKeys) {
				lines.push(
					wrapIdempotentConstraint(
						`ALTER TABLE "${table.schemaName}"."${table.tableName}" ADD CONSTRAINT "${table.tableName}_${fk.column}_fk" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.referencedSchema}"."${fk.referencedTable}" ("${fk.referencedColumn}") ON DELETE ${fk.onDelete.toUpperCase()}`,
					),
				);
			}

			for (const exclude of table.excludeConstraints) {
				const where = exclude.where ? ` WHERE (${exclude.where})` : "";
				lines.push(
					wrapIdempotentConstraint(
						`ALTER TABLE "${table.schemaName}"."${table.tableName}" ADD CONSTRAINT "${table.tableName}_exclude" EXCLUDE USING ${exclude.using} (${exclude.with})${where}`,
					),
				);
			}

			lines.push("");
		}
	}

	return lines.join("\n");
}

function compileModuleTables(
	moduleId: string,
	tables: Readonly<Record<string, TableDeclaration>>,
): CompileModuleResult {
	const compiled = Object.entries(tables).map(([tableName, declaration]) =>
		compileTableShape({
			moduleId,
			tableName,
			shape: declaration.shape,
			...(declaration.excludes ? { excludes: declaration.excludes } : {}),
		}),
	);

	return { moduleId, tables: compiled };
}

/** Compile all modules with `tables` declared; list others as not transcoded. */
export function compileModuleDeclarations(
	modules: readonly Module[],
): CompileReport {
	const transcoded: CompileModuleResult[] = [];
	const notTranscoded: string[] = [];

	for (const module of modules) {
		if (module.tables && Object.keys(module.tables).length > 0) {
			transcoded.push(compileModuleTables(module.id, module.tables));
		} else if (module.schema && Object.keys(module.schema).length > 0) {
			notTranscoded.push(module.id);
		}
	}

	const sql = emitSql(transcoded);

	return { transcoded, notTranscoded, sql };
}

/** Format a human-readable report for stdout. */
export function formatCompileReport(report: CompileReport): string {
	const sections: string[] = [];

	for (const module of report.transcoded) {
		sections.push(`-- Module: ${module.moduleId}`);
		for (const table of module.tables) {
			sections.push(
				`--   ${table.schemaName}.${table.tableName} (${table.columns.length} columns)`,
			);
		}
	}

	sections.push("");
	sections.push(report.sql);

	if (report.notTranscoded.length > 0) {
		sections.push("");
		sections.push("-- Not transcoded (legacy ModuleSchema only):");
		for (const id of [...report.notTranscoded].sort((a, b) =>
			a.localeCompare(b),
		)) {
			sections.push(`--   ${id}`);
		}
	}

	return sections.join("\n");
}
