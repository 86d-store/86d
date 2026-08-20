import type { ColumnExclude, ColumnMeta, ColumnReference } from "./col";
import { col } from "./col";
import { compileTableShape } from "./compile/analyze-zod";
import {
	compileModuleDeclarations,
	emitSql,
	formatCompileReport,
} from "./compile/index";
import {
	isTranscodedModule,
	listNotTranscodedModules,
	summarizeLegacySchema,
} from "./compile/module-schema-adapter";
import type {
	CompiledColumn,
	CompiledTable,
	CompileModuleResult,
	CompileReport,
} from "./compile/types";
import type {
	AnchorDeclaration,
	CoreExtensionDeclaration,
	ModuleStorageTier,
	PublishedView,
	TableDeclaration,
} from "./declaration";
import { moduleStorageTier } from "./declaration";
import { transcodeModuleSchema } from "./transcode";

export type {
	AnchorDeclaration,
	ColumnExclude,
	ColumnMeta,
	ColumnReference,
	CompiledColumn,
	CompiledTable,
	CompileModuleResult,
	CompileReport,
	CoreExtensionDeclaration,
	ModuleStorageTier,
	PublishedView,
	TableDeclaration,
};
export {
	col,
	compileModuleDeclarations,
	compileTableShape,
	emitSql,
	formatCompileReport,
	isTranscodedModule,
	listNotTranscodedModules,
	moduleStorageTier,
	summarizeLegacySchema,
	transcodeModuleSchema,
};
