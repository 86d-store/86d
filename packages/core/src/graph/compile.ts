import type { AnyCapabilityDefinition } from "../capabilities";
import type { AnyDurableEventDefinition } from "../durable-events";
import type { PublishedView, StableSemVer } from "../schema/declaration";
import type { Module } from "../types/module";
import type { ContractRange } from "./contract-range";
import { validateContractRanges } from "./contract-range";
import { GraphCompileError, type GraphDiagnostic } from "./diagnostics";
import { digestObject } from "./digest";
import {
	type AnyHookImplementation,
	type AnyHookPointDefinition,
	assertHookImplementationId,
	hookImplementationIdentity,
	normalizeHookPriority,
	orderHookImplementations,
} from "./hooks";
import type {
	AnyTemplateDataProjection,
	CompiledReaderBinding,
	CompiledTemplateProjectionBinding,
	ReaderAcceptance,
	TemplateDataRequirement,
} from "./projections";
import type { VersionedDefinition } from "./resolve";
import { resolveHighestMatchingVersion } from "./resolve";
import { isStableSemVer } from "./semver";

export type CompiledCapabilityBinding =
	| Readonly<{
			available: true;
			consumerId: string;
			name: string;
			owner: string;
			version: StableSemVer;
			providerModuleId: string;
	  }>
	| Readonly<{
			available: false;
			reason: "OWNER_NOT_INSTALLED";
			consumerId: string;
			name: string;
			owner: string;
	  }>;

export type CompiledHookChain = Readonly<{
	owner: string;
	name: string;
	version: StableSemVer;
	order: readonly string[];
}>;

export type CompiledDurableEventEdge = Readonly<{
	owner: string;
	name: string;
	schemaVersion: number;
	consumers: readonly string[];
}>;

export type CompiledExecutionGraph = Readonly<{
	graphDigest: string;
	registryDigest: string;
	edgeManifest: Readonly<{
		capabilities: readonly CompiledCapabilityBinding[];
		hooks: readonly CompiledHookChain[];
		readers: Readonly<Record<string, readonly CompiledReaderBinding[]>>;
		templateProjections: Readonly<
			Record<string, readonly CompiledTemplateProjectionBinding[]>
		>;
		durableEvents: readonly CompiledDurableEventEdge[];
		moduleRequires: readonly Readonly<{
			consumerId: string;
			module: string;
			version: StableSemVer;
			optional: boolean;
		}>[];
	}>;
	/** Exact dispatch keys: consumerId\0name → resolved version or unavailable. */
	capabilityDispatch: ReadonlyMap<string, CompiledCapabilityBinding>;
	hookChains: ReadonlyMap<string, CompiledHookChain>;
	hookImplementations: ReadonlyMap<
		string,
		AnyHookImplementation & { moduleId: string }
	>;
	capabilityProviders: ReadonlyMap<
		string,
		{ moduleId: string; definition: AnyCapabilityDefinition }
	>;
}>;

export type TemplateCompileInput = Readonly<{
	templateId: string;
	data: readonly TemplateDataRequirement[];
}>;

export type CompileExecutionGraphInput = Readonly<{
	modules: readonly Module[];
	templates?: readonly TemplateCompileInput[] | undefined;
}>;

function capabilityKey(consumerId: string, name: string): string {
	return `${consumerId}\0${name}`;
}

function hookChainKey(owner: string, name: string, version: string): string {
	return `${owner}\0${name}\0${version}`;
}

function publishedViewsOf(
	module: Module,
): Readonly<Record<string, PublishedView>> {
	const storage = module.storage;
	if (storage?.kind === "relational" && storage.publishes) {
		return storage.publishes;
	}
	return module.publishes ?? {};
}

function moduleRequirementEntries(module: Module): readonly Readonly<{
	module: string;
	versions: readonly string[];
	optional: boolean;
}>[] {
	const requires = module.requires;
	if (!requires) return [];
	if (Array.isArray(requires)) {
		if (requires.length === 0) return [];
		const first = requires[0];
		if (typeof first === "string") {
			return requires.map((id) => ({
				module: id as string,
				versions: ["^0.0.0"] as const,
				optional: false,
			}));
		}
		return (
			requires as unknown as readonly {
				module: string;
				versions: readonly ContractRange[];
				optional?: true;
			}[]
		).map((entry) => ({
			module: entry.module,
			versions: entry.versions,
			optional: entry.optional === true,
		}));
	}
	return Object.entries(requires).map(([id, contract]) => ({
		module: id,
		versions: ["^0.0.0"] as const,
		optional: contract.optional === true,
	}));
}

function throwIfDiagnostics(diagnostics: readonly GraphDiagnostic[]): void {
	if (diagnostics.length > 0) {
		throw new GraphCompileError(Object.freeze([...diagnostics]));
	}
}

/**
 * Compile one deterministic execution graph for capabilities, hooks, durable
 * events, readers, and template data. Fail closed on missing, incompatible,
 * ambiguous, or cyclic edges.
 */
export function compileExecutionGraph(
	input: CompileExecutionGraphInput,
): CompiledExecutionGraph {
	const diagnostics: GraphDiagnostic[] = [];
	const modules = input.modules;
	const installed = new Map<string, Module>();

	for (const module of modules) {
		if (installed.has(module.id)) {
			diagnostics.push({
				code: "DUPLICATE_MODULE_ID",
				message: `Module ID "${module.id}" is declared more than once.`,
				moduleId: module.id,
			});
			continue;
		}
		if (!isStableSemVer(module.version)) {
			diagnostics.push({
				code: "INVALID_RANGE_GRAMMAR",
				message: `Module "${module.id}" version must be stable MAJOR.MINOR.PATCH.`,
				moduleId: module.id,
			});
			continue;
		}
		installed.set(module.id, module);
	}

	const moduleDefinitions: VersionedDefinition[] = [...installed.values()].map(
		(module) => ({
			kind: "module" as const,
			owner: module.id,
			name: module.id,
			version: module.version,
		}),
	);

	const capabilityDefinitions: VersionedDefinition[] = [];
	const capabilityProviders = new Map<
		string,
		{ moduleId: string; definition: AnyCapabilityDefinition }
	>();
	const capabilityIdentityCounts = new Map<string, number>();

	for (const module of installed.values()) {
		for (const provider of module.capabilities?.provides ?? []) {
			const definition = provider.definition;
			if (definition.owner !== module.id) {
				diagnostics.push({
					code: "INSTALLED_OWNER_MISSING_CONTRACT",
					message: `Module "${module.id}" cannot provide "${definition.name}" owned by "${definition.owner}".`,
					moduleId: module.id,
					edge: definition.name,
				});
				continue;
			}
			if (!isStableSemVer(definition.version)) {
				diagnostics.push({
					code: "INVALID_RANGE_GRAMMAR",
					message: `Capability "${definition.name}" version must be stable SemVer.`,
					moduleId: module.id,
					edge: definition.name,
				});
				continue;
			}
			const identity = `capability:${definition.owner}/${definition.name}@${definition.version}`;
			capabilityIdentityCounts.set(
				identity,
				(capabilityIdentityCounts.get(identity) ?? 0) + 1,
			);
			capabilityDefinitions.push({
				kind: "capability",
				owner: definition.owner,
				name: definition.name,
				version: definition.version,
			});
			capabilityProviders.set(
				`${definition.owner}\0${definition.name}\0${definition.version}`,
				{ moduleId: module.id, definition },
			);
		}
	}

	for (const [identity, count] of capabilityIdentityCounts) {
		if (count > 1) {
			diagnostics.push({
				code: "DUPLICATE_IDENTITY",
				message: `Duplicate capability identity ${identity}.`,
				edge: identity,
			});
		}
	}

	const capabilityBindings: CompiledCapabilityBinding[] = [];
	const capabilityDispatch = new Map<string, CompiledCapabilityBinding>();

	for (const consumer of installed.values()) {
		for (const acceptance of consumer.capabilities?.accepts ?? []) {
			const ranges = validateContractRanges(acceptance.versions);
			if (!ranges.ok) {
				diagnostics.push({
					code: "INVALID_RANGE_GRAMMAR",
					message: `Invalid capability range for "${acceptance.name}": ${ranges.reason}${ranges.invalid ? ` (${ranges.invalid})` : ""}.`,
					moduleId: consumer.id,
					edge: acceptance.name,
				});
				continue;
			}

			const ownerInstalled = installed.has(acceptance.owner);
			const ownerDefinitions = capabilityDefinitions.filter(
				(definition) =>
					definition.owner === acceptance.owner &&
					definition.name === acceptance.name,
			);

			if (!ownerInstalled) {
				if (acceptance.optional) {
					const binding: CompiledCapabilityBinding = {
						available: false,
						reason: "OWNER_NOT_INSTALLED",
						consumerId: consumer.id,
						name: acceptance.name,
						owner: acceptance.owner,
					};
					capabilityBindings.push(binding);
					capabilityDispatch.set(
						capabilityKey(consumer.id, acceptance.name),
						binding,
					);
					continue;
				}
				diagnostics.push({
					code: "REQUIRED_OWNER_ABSENT",
					message: `Required capability owner "${acceptance.owner}" is not installed.`,
					moduleId: consumer.id,
					edge: acceptance.name,
				});
				continue;
			}

			if (ownerDefinitions.length === 0) {
				diagnostics.push({
					code: "INSTALLED_OWNER_MISSING_CONTRACT",
					message: `Owner "${acceptance.owner}" is installed but does not provide "${acceptance.name}".`,
					moduleId: consumer.id,
					edge: acceptance.name,
				});
				continue;
			}

			const resolved = resolveHighestMatchingVersion({
				kind: "capability",
				owner: acceptance.owner,
				name: acceptance.name,
				ranges: ranges.ranges,
				definitions: ownerDefinitions,
			});

			if (!resolved.ok) {
				if (resolved.reason === "duplicate_identity") {
					diagnostics.push({
						code: "DUPLICATE_IDENTITY",
						message: `Duplicate capability while resolving "${acceptance.name}".`,
						moduleId: consumer.id,
						edge: resolved.detail,
					});
				} else {
					diagnostics.push({
						code: "INCOMPATIBLE_VERSION",
						message: `No compatible version of "${acceptance.name}" for Module "${consumer.id}".`,
						moduleId: consumer.id,
						edge: acceptance.name,
					});
				}
				continue;
			}

			const provider = capabilityProviders.get(
				`${acceptance.owner}\0${acceptance.name}\0${resolved.version}`,
			);
			if (!provider) {
				diagnostics.push({
					code: "INSTALLED_OWNER_MISSING_CONTRACT",
					message: `Resolved capability "${acceptance.name}@${resolved.version}" has no provider.`,
					moduleId: consumer.id,
					edge: acceptance.name,
				});
				continue;
			}

			const binding: CompiledCapabilityBinding = {
				available: true,
				consumerId: consumer.id,
				name: acceptance.name,
				owner: acceptance.owner,
				version: resolved.version as StableSemVer,
				providerModuleId: provider.moduleId,
			};
			capabilityBindings.push(binding);
			capabilityDispatch.set(
				capabilityKey(consumer.id, acceptance.name),
				binding,
			);
		}
	}

	// Module requires (versioned form + legacy compatibility).
	const moduleRequires: Array<{
		consumerId: string;
		module: string;
		version: StableSemVer;
		optional: boolean;
	}> = [];
	for (const consumer of installed.values()) {
		for (const requirement of moduleRequirementEntries(consumer)) {
			const ranges = validateContractRanges([...requirement.versions]);
			if (!ranges.ok && requirement.versions[0] !== "^0.0.0") {
				diagnostics.push({
					code: "INVALID_RANGE_GRAMMAR",
					message: `Invalid requires range for "${requirement.module}".`,
					moduleId: consumer.id,
					edge: requirement.module,
				});
				continue;
			}

			const owner = installed.get(requirement.module);
			if (!owner) {
				if (requirement.optional) {
					continue;
				}
				// Legacy string requires treat absence as a boot concern; only
				// fail closed for explicit versioned requires.
				const isVersioned = Array.isArray(consumer.requires)
					? typeof consumer.requires[0] === "object"
					: false;
				if (isVersioned) {
					diagnostics.push({
						code: "REQUIRED_OWNER_ABSENT",
						message: `Required Module "${requirement.module}" is not installed.`,
						moduleId: consumer.id,
						edge: requirement.module,
					});
				}
				continue;
			}

			if (
				Array.isArray(consumer.requires) &&
				typeof consumer.requires[0] === "object"
			) {
				const resolved = resolveHighestMatchingVersion({
					kind: "module",
					owner: requirement.module,
					name: requirement.module,
					ranges: ranges.ok ? ranges.ranges : ["^0.0.0"],
					definitions: moduleDefinitions.filter(
						(definition) => definition.name === requirement.module,
					),
				});
				if (!resolved.ok) {
					diagnostics.push({
						code: "INCOMPATIBLE_VERSION",
						message: `No compatible version of Module "${requirement.module}".`,
						moduleId: consumer.id,
						edge: requirement.module,
					});
					continue;
				}
				moduleRequires.push({
					consumerId: consumer.id,
					module: requirement.module,
					version: resolved.version as StableSemVer,
					optional: requirement.optional,
				});
			}
		}
	}

	// Hooks
	const hookPoints = new Map<string, AnyHookPointDefinition>();
	const hookPointDefinitions: VersionedDefinition[] = [];
	const hookImplementations = new Map<
		string,
		AnyHookImplementation & { moduleId: string }
	>();

	for (const module of installed.values()) {
		for (const point of module.hooks?.defines ?? []) {
			if (point.owner !== module.id) {
				diagnostics.push({
					code: "INSTALLED_OWNER_MISSING_CONTRACT",
					message: `Module "${module.id}" cannot define hook "${point.name}" owned by "${point.owner}".`,
					moduleId: module.id,
					edge: point.name,
				});
				continue;
			}
			if (!isStableSemVer(point.version)) {
				diagnostics.push({
					code: "INVALID_RANGE_GRAMMAR",
					message: `Hook "${point.name}" version must be stable SemVer.`,
					moduleId: module.id,
					edge: point.name,
				});
				continue;
			}
			const key = `${point.owner}\0${point.name}\0${point.version}`;
			if (hookPoints.has(key)) {
				diagnostics.push({
					code: "DUPLICATE_IDENTITY",
					message: `Duplicate hook point ${point.owner}/${point.name}@${point.version}.`,
					moduleId: module.id,
					edge: point.name,
				});
				continue;
			}
			hookPoints.set(key, point);
			hookPointDefinitions.push({
				kind: "hook",
				owner: point.owner,
				name: point.name,
				version: point.version,
			});
		}
	}

	const implementationsByPoint = new Map<
		string,
		Array<{
			moduleId: string;
			implementationId: string;
			priority: number;
			before: readonly string[];
			after: readonly string[];
			impl: AnyHookImplementation;
		}>
	>();

	for (const module of installed.values()) {
		for (const impl of module.hooks?.implements ?? []) {
			try {
				assertHookImplementationId(impl.implementationId);
			} catch {
				diagnostics.push({
					code: "INVALID_HOOK_IDENTITY",
					message: `Invalid hook implementation id "${impl.implementationId}".`,
					moduleId: module.id,
					edge: impl.definition.name,
				});
				continue;
			}

			let priority: number;
			try {
				priority = normalizeHookPriority(impl.priority);
			} catch {
				diagnostics.push({
					code: "INVALID_HOOK_PRIORITY",
					message: `Invalid hook priority for "${impl.implementationId}".`,
					moduleId: module.id,
					edge: impl.definition.name,
				});
				continue;
			}

			const ownerInstalled = installed.has(impl.definition.owner);
			if (!ownerInstalled) {
				diagnostics.push({
					code: "REQUIRED_OWNER_ABSENT",
					message: `Hook owner "${impl.definition.owner}" is not installed.`,
					moduleId: module.id,
					edge: impl.definition.name,
				});
				continue;
			}

			const pointDefs = hookPointDefinitions.filter(
				(definition) =>
					definition.owner === impl.definition.owner &&
					definition.name === impl.definition.name,
			);
			if (pointDefs.length === 0) {
				diagnostics.push({
					code: "INSTALLED_OWNER_MISSING_CONTRACT",
					message: `Owner "${impl.definition.owner}" does not define hook "${impl.definition.name}".`,
					moduleId: module.id,
					edge: impl.definition.name,
				});
				continue;
			}

			const resolved = resolveHighestMatchingVersion({
				kind: "hook",
				owner: impl.definition.owner,
				name: impl.definition.name,
				ranges: [impl.definition.version],
				definitions: pointDefs,
			});
			if (!resolved.ok) {
				diagnostics.push({
					code: "INCOMPATIBLE_VERSION",
					message: `Hook implementation "${impl.implementationId}" has no compatible point version.`,
					moduleId: module.id,
					edge: impl.definition.name,
				});
				continue;
			}

			const pointKey = hookChainKey(
				impl.definition.owner,
				impl.definition.name,
				resolved.version,
			);
			const identity = hookImplementationIdentity(
				module.id,
				impl.implementationId,
			);
			if (hookImplementations.has(identity)) {
				diagnostics.push({
					code: "DUPLICATE_IDENTITY",
					message: `Duplicate hook implementation identity "${identity}".`,
					moduleId: module.id,
					edge: identity,
				});
				continue;
			}
			hookImplementations.set(identity, { ...impl, moduleId: module.id });
			const list = implementationsByPoint.get(pointKey) ?? [];
			list.push({
				moduleId: module.id,
				implementationId: impl.implementationId,
				priority,
				before: impl.before ?? [],
				after: impl.after ?? [],
				impl,
			});
			implementationsByPoint.set(pointKey, list);
		}
	}

	const hookChains = new Map<string, CompiledHookChain>();
	const hookChainList: CompiledHookChain[] = [];

	for (const [pointKey, point] of hookPoints) {
		const impls = implementationsByPoint.get(pointKey) ?? [];
		const minimum = point.minimumImplementers ?? 0;
		if (impls.length < minimum) {
			diagnostics.push({
				code: "MINIMUM_IMPLEMENTERS",
				message: `Hook "${point.name}" requires at least ${minimum} implementer(s).`,
				moduleId: point.owner,
				edge: point.name,
			});
			continue;
		}
		const ordered = orderHookImplementations(impls);
		if (!ordered.ok) {
			diagnostics.push({
				code:
					ordered.reason === "cycle"
						? "HOOK_CYCLE"
						: "HOOK_ORDER_REFERENCE_ABSENT",
				message:
					ordered.reason === "cycle"
						? `Hook cycle among ${ordered.detail}.`
						: `Absent hook order reference: ${ordered.detail}.`,
				moduleId: point.owner,
				edge: point.name,
			});
			continue;
		}
		const chain: CompiledHookChain = {
			owner: point.owner,
			name: point.name,
			version: point.version as StableSemVer,
			order: ordered.order,
		};
		hookChains.set(pointKey, chain);
		hookChainList.push(chain);
	}

	// Readers from publishes
	const readerDefinitions: VersionedDefinition[] = [];
	const readerViews = new Map<
		string,
		{ owner: string; name: string; view: PublishedView }
	>();

	for (const module of installed.values()) {
		for (const [name, view] of Object.entries(publishedViewsOf(module))) {
			if (!isStableSemVer(view.version)) {
				diagnostics.push({
					code: "INVALID_RANGE_GRAMMAR",
					message: `Published view "${name}" version must be stable SemVer.`,
					moduleId: module.id,
					edge: name,
				});
				continue;
			}
			readerDefinitions.push({
				kind: "reader",
				owner: module.id,
				name,
				version: view.version,
			});
			readerViews.set(`${module.id}\0${name}\0${view.version}`, {
				owner: module.id,
				name,
				view,
			});
		}
	}

	const readersByConsumer: Record<string, CompiledReaderBinding[]> = {};

	for (const consumer of installed.values()) {
		const acceptances: readonly ReaderAcceptance[] =
			consumer.readers?.accepts ?? [];
		for (const acceptance of acceptances) {
			const ranges = validateContractRanges(acceptance.versions);
			if (!ranges.ok) {
				diagnostics.push({
					code: "INVALID_RANGE_GRAMMAR",
					message: `Invalid reader range for "${acceptance.owner}.${acceptance.name}".`,
					moduleId: consumer.id,
					edge: `${acceptance.owner}.${acceptance.name}`,
				});
				continue;
			}

			const ownerInstalled = installed.has(acceptance.owner);
			const ownerDefs = readerDefinitions.filter(
				(definition) =>
					definition.owner === acceptance.owner &&
					definition.name === acceptance.name,
			);

			if (!ownerInstalled) {
				if (acceptance.optional) {
					const binding: CompiledReaderBinding = {
						available: false,
						reason: "OWNER_NOT_INSTALLED",
						owner: acceptance.owner,
						name: acceptance.name,
					};
					const list = readersByConsumer[consumer.id] ?? [];
					list.push(binding);
					readersByConsumer[consumer.id] = list;
					continue;
				}
				diagnostics.push({
					code: "MISSING_READER",
					message: `Required reader "${acceptance.owner}.${acceptance.name}" owner is not installed.`,
					moduleId: consumer.id,
					edge: `${acceptance.owner}.${acceptance.name}`,
				});
				continue;
			}

			if (ownerDefs.length === 0) {
				diagnostics.push({
					code: "INSTALLED_OWNER_MISSING_CONTRACT",
					message: `Owner "${acceptance.owner}" is installed but does not publish "${acceptance.name}".`,
					moduleId: consumer.id,
					edge: `${acceptance.owner}.${acceptance.name}`,
				});
				continue;
			}

			const resolved = resolveHighestMatchingVersion({
				kind: "reader",
				owner: acceptance.owner,
				name: acceptance.name,
				ranges: ranges.ranges,
				definitions: ownerDefs,
			});
			if (!resolved.ok) {
				diagnostics.push({
					code: "INCOMPATIBLE_VERSION",
					message: `No compatible reader version for "${acceptance.owner}.${acceptance.name}".`,
					moduleId: consumer.id,
					edge: `${acceptance.owner}.${acceptance.name}`,
				});
				continue;
			}

			const view = readerViews.get(
				`${acceptance.owner}\0${acceptance.name}\0${resolved.version}`,
			);
			if (!view) {
				diagnostics.push({
					code: "MISSING_READER",
					message: `Resolved reader "${acceptance.name}@${resolved.version}" is missing.`,
					moduleId: consumer.id,
					edge: acceptance.name,
				});
				continue;
			}

			const readerList = readersByConsumer[consumer.id] ?? [];
			readerList.push({
				available: true,
				owner: acceptance.owner,
				name: acceptance.name,
				version: resolved.version as StableSemVer,
				table: view.view.table,
				columns: view.view.columns,
			});
			readersByConsumer[consumer.id] = readerList;
		}
	}

	// Template projections
	const projectionDefinitions: VersionedDefinition[] = [];
	const projectionIndex = new Map<
		string,
		AnyTemplateDataProjection & { owner: string }
	>();

	for (const module of installed.values()) {
		const data = module.templates?.data ?? {};
		for (const [key, value] of Object.entries(data)) {
			const projections = Array.isArray(value) ? value : [value];
			for (const proj of projections) {
				const name = proj.name || key;
				if (!isStableSemVer(proj.version)) {
					diagnostics.push({
						code: "INVALID_RANGE_GRAMMAR",
						message: `Template projection "${name}" version must be stable SemVer.`,
						moduleId: module.id,
						edge: name,
					});
					continue;
				}
				projectionDefinitions.push({
					kind: "template-projection",
					owner: module.id,
					name,
					version: proj.version,
				});
				projectionIndex.set(`${module.id}\0${name}\0${proj.version}`, {
					...proj,
					name,
					owner: module.id,
				});
			}
		}
	}

	const templateProjections: Record<
		string,
		CompiledTemplateProjectionBinding[]
	> = {};

	for (const template of input.templates ?? []) {
		for (const requirement of template.data) {
			const [owner, name] = splitProjectionRef(requirement.projection);
			if (!owner || !name) {
				diagnostics.push({
					code: "MISSING_TEMPLATE_DATA",
					message: `Template "${template.templateId}" names invalid projection "${requirement.projection}".`,
					edge: requirement.projection,
				});
				continue;
			}

			const ranges = validateContractRanges(requirement.versions);
			if (!ranges.ok) {
				diagnostics.push({
					code: "INVALID_RANGE_GRAMMAR",
					message: `Invalid template projection range for "${requirement.projection}".`,
					edge: requirement.projection,
				});
				continue;
			}

			const ownerInstalled = installed.has(owner);
			const ownerDefs = projectionDefinitions.filter(
				(definition) => definition.owner === owner && definition.name === name,
			);

			if (!ownerInstalled) {
				if (requirement.optional) {
					const list = templateProjections[template.templateId] ?? [];
					list.push({
						available: false,
						reason: "OWNER_NOT_INSTALLED",
						owner,
						name,
					});
					templateProjections[template.templateId] = list;
					continue;
				}
				diagnostics.push({
					code: "MISSING_TEMPLATE_DATA",
					message: `Template "${template.templateId}" requires projection from uninstalled Module "${owner}".`,
					edge: requirement.projection,
				});
				continue;
			}

			if (ownerDefs.length === 0) {
				diagnostics.push({
					code: "INSTALLED_OWNER_MISSING_CONTRACT",
					message: `Module "${owner}" is installed but does not project "${name}".`,
					edge: requirement.projection,
				});
				continue;
			}

			const resolved = resolveHighestMatchingVersion({
				kind: "template-projection",
				owner,
				name,
				ranges: ranges.ranges,
				definitions: ownerDefs,
			});
			if (!resolved.ok) {
				diagnostics.push({
					code: "INCOMPATIBLE_VERSION",
					message: `No compatible projection version for "${requirement.projection}".`,
					edge: requirement.projection,
				});
				continue;
			}

			const projectionList = templateProjections[template.templateId] ?? [];
			projectionList.push({
				available: true,
				owner,
				name,
				version: resolved.version as StableSemVer,
			});
			templateProjections[template.templateId] = projectionList;
		}
	}

	// Durable events — exact integer schema versions
	const durableEventDefs = new Map<string, AnyDurableEventDefinition>();
	const durableConsumers = new Map<string, string[]>();

	for (const module of installed.values()) {
		for (const definition of module.durableEvents?.emits ?? []) {
			if (definition.owner !== module.id) {
				diagnostics.push({
					code: "INSTALLED_OWNER_MISSING_CONTRACT",
					message: `Module "${module.id}" cannot emit "${definition.name}" owned by "${definition.owner}".`,
					moduleId: module.id,
					edge: definition.name,
				});
				continue;
			}
			if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
				diagnostics.push({
					code: "INVALID_EVENT_VERSION",
					message: `Durable event "${definition.name}" version must be a positive integer.`,
					moduleId: module.id,
					edge: definition.name,
				});
				continue;
			}
			const key = `${definition.owner}\0${definition.name}\0${definition.version}`;
			if (durableEventDefs.has(key)) {
				diagnostics.push({
					code: "DUPLICATE_IDENTITY",
					message: `Duplicate durable event ${definition.owner}/${definition.name}@${definition.version}.`,
					moduleId: module.id,
					edge: definition.name,
				});
				continue;
			}
			durableEventDefs.set(key, definition);
			durableConsumers.set(key, []);
		}
	}

	for (const module of installed.values()) {
		for (const consumer of module.durableEvents?.handles ?? []) {
			const definition = consumer.definition;
			if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
				diagnostics.push({
					code: "INVALID_EVENT_VERSION",
					message: `Durable event consumer version must be a positive integer.`,
					moduleId: module.id,
					edge: consumer.consumer,
				});
				continue;
			}
			const key = `${definition.owner}\0${definition.name}\0${definition.version}`;
			const ownerInstalled = installed.has(definition.owner);
			if (!ownerInstalled) {
				if (consumer.optional) continue;
				diagnostics.push({
					code: "REQUIRED_OWNER_ABSENT",
					message: `Durable event owner "${definition.owner}" is not installed.`,
					moduleId: module.id,
					edge: definition.name,
				});
				continue;
			}
			if (!durableEventDefs.has(key)) {
				if (consumer.optional) continue;
				diagnostics.push({
					code: "EVENT_CONSUMER_GAP",
					message: `No exact durable event ${definition.name}@${definition.version} for consumer "${consumer.consumer}".`,
					moduleId: module.id,
					edge: definition.name,
				});
				continue;
			}
			durableConsumers.get(key)?.push(consumer.consumer);
		}
	}

	const durableEvents: CompiledDurableEventEdge[] = [...durableEventDefs].map(
		([key, definition]) => ({
			owner: definition.owner,
			name: definition.name,
			schemaVersion: definition.version,
			consumers: Object.freeze([...(durableConsumers.get(key) ?? [])].sort()),
		}),
	);

	throwIfDiagnostics(diagnostics);

	capabilityBindings.sort((a, b) => {
		const left = `${a.consumerId}:${a.name}`;
		const right = `${b.consumerId}:${b.name}`;
		return left < right ? -1 : left > right ? 1 : 0;
	});
	hookChainList.sort((a, b) => {
		const left = `${a.owner}:${a.name}@${a.version}`;
		const right = `${b.owner}:${b.name}@${b.version}`;
		return left < right ? -1 : left > right ? 1 : 0;
	});
	durableEvents.sort((a, b) => {
		const left = `${a.owner}:${a.name}@${a.schemaVersion}`;
		const right = `${b.owner}:${b.name}@${b.schemaVersion}`;
		return left < right ? -1 : left > right ? 1 : 0;
	});

	const edgeManifest = Object.freeze({
		capabilities: Object.freeze([...capabilityBindings]),
		hooks: Object.freeze([...hookChainList]),
		readers: Object.freeze({ ...readersByConsumer }),
		templateProjections: Object.freeze({ ...templateProjections }),
		durableEvents: Object.freeze([...durableEvents]),
		moduleRequires: Object.freeze([...moduleRequires]),
	});

	const registryDigest = digestObject(
		[...installed.values()]
			.map((module) => ({ id: module.id, version: module.version }))
			.sort((a, b) => (a.id < b.id ? -1 : 1)),
	);
	const graphDigest = digestObject(edgeManifest);

	return Object.freeze({
		graphDigest,
		registryDigest,
		edgeManifest,
		capabilityDispatch,
		hookChains,
		hookImplementations,
		capabilityProviders,
	});
}

function splitProjectionRef(
	ref: string,
): [string | undefined, string | undefined] {
	const dot = ref.indexOf(".");
	if (dot <= 0 || dot === ref.length - 1) return [undefined, undefined];
	return [ref.slice(0, dot), ref.slice(dot + 1)];
}

export function tryCompileExecutionGraph(
	input: CompileExecutionGraphInput,
):
	| Readonly<{ ok: true; graph: CompiledExecutionGraph }>
	| Readonly<{ ok: false; diagnostics: readonly GraphDiagnostic[] }> {
	try {
		return { ok: true, graph: compileExecutionGraph(input) };
	} catch (error) {
		if (error instanceof GraphCompileError) {
			return { ok: false, diagnostics: error.diagnostics };
		}
		throw error;
	}
}
