import type { ZodError } from "../../zod";
import type { CompiledTable } from "./types";

export type StorageParseIssue = Readonly<{
	moduleId: string;
	tableName: string;
	fieldName: string;
	message: string;
}>;

/** Typed Module-and-field error raised at the storage boundary. */
export class ModuleStorageParseError extends Error {
	readonly issues: readonly StorageParseIssue[];

	constructor(issues: readonly StorageParseIssue[]) {
		const first = issues[0];
		const summary = first
			? `${first.moduleId}.${first.tableName}.${first.fieldName}: ${first.message}`
			: "Module storage parse failed";
		super(
			issues.length > 1
				? `${summary} (and ${issues.length - 1} more)`
				: summary,
		);
		this.name = "ModuleStorageParseError";
		this.issues = issues;
	}
}

function zodIssuesToStorageIssues(
	moduleId: string,
	tableName: string,
	error: ZodError,
): StorageParseIssue[] {
	return error.issues.map((issue) => {
		const fieldName =
			issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)";
		return {
			moduleId,
			tableName,
			fieldName,
			message: issue.message,
		};
	});
}

/** Parse a write payload through the compiled table Zod shape. */
export function parseStorageWrite(
	compiled: CompiledTable,
	row: Record<string, unknown>,
): Record<string, unknown> {
	const result = compiled.shape.safeParse(row);
	if (!result.success) {
		throw new ModuleStorageParseError(
			zodIssuesToStorageIssues(
				compiled.moduleId,
				compiled.tableName,
				result.error,
			),
		);
	}
	return result.data as Record<string, unknown>;
}

/** Parse a decoded row through the compiled table Zod shape. */
export function parseStorageRead(
	compiled: CompiledTable,
	row: Record<string, unknown>,
): Record<string, unknown> {
	const normalized: Record<string, unknown> = { ...row };
	for (const column of compiled.columns) {
		if (
			normalized[column.name] === null &&
			column.optional &&
			!column.acceptsNull
		) {
			// SQL NULL for `.optional()` fields means omitted, not Zod null.
			delete normalized[column.name];
		}
	}
	const result = compiled.shape.safeParse(normalized);
	if (!result.success) {
		throw new ModuleStorageParseError(
			zodIssuesToStorageIssues(
				compiled.moduleId,
				compiled.tableName,
				result.error,
			),
		);
	}
	return result.data as Record<string, unknown>;
}
