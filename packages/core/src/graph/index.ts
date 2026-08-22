import type {
	CompiledCapabilityBinding,
	CompiledDurableEventEdge,
	CompiledExecutionGraph,
	CompiledHookChain,
	CompileExecutionGraphInput,
	TemplateCompileInput,
} from "./compile";
import { compileExecutionGraph, tryCompileExecutionGraph } from "./compile";
import type { ContractRange, ParsedContractRange } from "./contract-range";
import {
	isContractRange,
	matchesContractRanges,
	parseContractRange,
	validateContractRanges,
} from "./contract-range";
import type { GraphDiagnostic, GraphDiagnosticCode } from "./diagnostics";
import {
	diagnosticFingerprint,
	formatGraphDiagnostics,
	GraphCompileError,
} from "./diagnostics";
import { digestObject, sha256Hex, stableStringify } from "./digest";
import type {
	AnyHookImplementation,
	AnyHookPointDefinition,
	HookImplementation,
	HookPointDefinition,
} from "./hooks";
import {
	assertHookImplementationId,
	defineHook,
	hookImplementationIdentity,
	implementHook,
	normalizeHookPriority,
	orderHookImplementations,
	shallowMergePatches,
} from "./hooks";
import type {
	AnyTemplateDataProjection,
	CompiledReaderBinding,
	CompiledTemplateProjectionBinding,
	ReaderAcceptance,
	TemplateDataProjection,
	TemplateDataRequirement,
} from "./projections";
import { projection } from "./projections";
import type {
	ContractKind,
	ResolveVersionResult,
	VersionedDefinition,
} from "./resolve";
import { resolveHighestMatchingVersion } from "./resolve";
import { runCompiledHook } from "./run-hooks";
import type { ParsedSemVer } from "./semver";
import {
	compareSemVer,
	isStableSemVer,
	matchesCaret,
	parseStableSemVer,
} from "./semver";

export type {
	AnyHookImplementation,
	AnyHookPointDefinition,
	AnyTemplateDataProjection,
	CompiledCapabilityBinding,
	CompiledDurableEventEdge,
	CompiledExecutionGraph,
	CompiledHookChain,
	CompiledReaderBinding,
	CompiledTemplateProjectionBinding,
	CompileExecutionGraphInput,
	ContractKind,
	ContractRange,
	GraphDiagnostic,
	GraphDiagnosticCode,
	HookImplementation,
	HookPointDefinition,
	ParsedContractRange,
	ParsedSemVer,
	ReaderAcceptance,
	ResolveVersionResult,
	TemplateCompileInput,
	TemplateDataProjection,
	TemplateDataRequirement,
	VersionedDefinition,
};
export {
	assertHookImplementationId,
	compareSemVer,
	compileExecutionGraph,
	defineHook,
	diagnosticFingerprint,
	digestObject,
	formatGraphDiagnostics,
	GraphCompileError,
	hookImplementationIdentity,
	implementHook,
	isContractRange,
	isStableSemVer,
	matchesCaret,
	matchesContractRanges,
	normalizeHookPriority,
	orderHookImplementations,
	parseContractRange,
	parseStableSemVer,
	projection,
	resolveHighestMatchingVersion,
	runCompiledHook,
	sha256Hex,
	shallowMergePatches,
	stableStringify,
	tryCompileExecutionGraph,
	validateContractRanges,
};
