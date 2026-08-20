import { z } from "zod";

/** Column-level facts that have no Zod equivalent. See module-system.md. */
export type ColumnReference = Readonly<{
	table: string;
	column: string;
	onDelete?: "restrict" | "cascade" | "set null" | "no action";
}>;

export type ColumnExclude = Readonly<{
	using: "gist" | "btree";
	with: string;
	where?: string;
}>;

export type ColumnMeta = Readonly<{
	pk?: boolean;
	index?: boolean;
	unique?: boolean;
	anchor?: boolean;
	sensitive?: boolean;
	references?: ColumnReference;
	excludes?: readonly ColumnExclude[];
}>;

/** Registry for column metadata beside Zod shapes. */
export const col = z.registry<ColumnMeta>();
