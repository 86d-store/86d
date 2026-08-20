import type { ColumnExclude, ColumnMeta, ColumnReference } from "./col";
import { col } from "./col";
import { compileTableShape } from "./compile/analyze-zod";
import type {
	ConstructProvenance,
	FeatureManifest,
	FeatureManifestEntry,
} from "./compile/feature-manifest";
import {
	buildFeatureManifest,
	findUnsupportedConstruct,
} from "./compile/feature-manifest";
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
import type { StorageParseIssue } from "./compile/storage-parse";
import {
	ModuleStorageParseError,
	parseStorageRead,
	parseStorageWrite,
} from "./compile/storage-parse";
import type {
	CompiledColumn,
	CompiledTable,
	CompileModuleResult,
	CompileProvenance,
	CompileReport,
} from "./compile/types";
import { SchemaCompileError } from "./compile/types";
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
	CompileProvenance,
	CompileReport,
	ConstructProvenance,
	CoreExtensionDeclaration,
	FeatureManifest,
	FeatureManifestEntry,
	ModuleStorageTier,
	PublishedView,
	StorageParseIssue,
	TableDeclaration,
};
export {
	buildFeatureManifest,
	col,
	compileModuleDeclarations,
	compileTableShape,
	emitSql,
	findUnsupportedConstruct,
	formatCompileReport,
	isTranscodedModule,
	listNotTranscodedModules,
	ModuleStorageParseError,
	moduleStorageTier,
	parseStorageRead,
	parseStorageWrite,
	SchemaCompileError,
	summarizeLegacySchema,
	transcodeModuleSchema,
};
