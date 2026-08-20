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
	ConfigValues,
	CoreExtensionDeclaration,
	ModuleStorageDeclaration,
	ModuleStorageTier,
	PublishedView,
	StableSemVer,
	TableDeclaration,
} from "./declaration";
import {
	moduleStorageTier,
	resolveModuleStorage,
	storageConfig,
	storageTables,
} from "./declaration";
import {
	compileIsolationArtifacts,
	DEFAULT_MODULE_STATEMENT_TIMEOUT_MS,
	emitIsolationSql,
	moduleStorageOrThrow,
	STORE_LOGIN_ROLE,
	STORE_OWNER_ROLE,
} from "./isolation";
import type { StorageValidationIssue } from "./storage-validate";
import {
	assertValidStorageDeclaration,
	StorageDeclarationError,
	validateStorageDeclaration,
} from "./storage-validate";

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
	ConfigValues,
	ConstructProvenance,
	CoreExtensionDeclaration,
	FeatureManifest,
	FeatureManifestEntry,
	ModuleStorageDeclaration,
	ModuleStorageTier,
	PublishedView,
	StableSemVer,
	StorageParseIssue,
	StorageValidationIssue,
	TableDeclaration,
};
export {
	assertValidStorageDeclaration,
	buildFeatureManifest,
	col,
	compileIsolationArtifacts,
	compileModuleDeclarations,
	compileTableShape,
	DEFAULT_MODULE_STATEMENT_TIMEOUT_MS,
	emitIsolationSql,
	emitSql,
	findUnsupportedConstruct,
	formatCompileReport,
	isTranscodedModule,
	listNotTranscodedModules,
	ModuleStorageParseError,
	moduleStorageOrThrow,
	moduleStorageTier,
	parseStorageRead,
	parseStorageWrite,
	resolveModuleStorage,
	SchemaCompileError,
	STORE_LOGIN_ROLE,
	STORE_OWNER_ROLE,
	StorageDeclarationError,
	storageConfig,
	storageTables,
	summarizeLegacySchema,
	validateStorageDeclaration,
};
