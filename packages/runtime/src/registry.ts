import type {
	AnyCapabilityDefinition,
	CapabilityDecision,
	CapabilityFailure,
	CapabilityInvoker,
	CapabilityKernelFailure,
	CapabilityProvider,
	CapabilityRejected,
	CapabilityRequest,
	CapabilityResult,
} from "@86d-app/core/capabilities";
import {
	formatViolations,
	getRequiredModuleIds,
	validateContracts,
} from "@86d-app/core/contracts";
import type {
	AnyDurableEventConsumer,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { EndpointExposureEntry } from "@86d-app/core/endpoint-exposure";
import {
	collectEndpointExposures,
	formatEndpointExposureViolations,
} from "@86d-app/core/endpoint-exposure";
import {
	createEventBus,
	createScopedEmitter,
	type EventBus,
	type EventBusOptions,
} from "@86d-app/core/events";
import { formatPathConflicts, validateUniquePaths } from "@86d-app/core/paths";
import type { Primitive } from "@86d-app/core/types/helper";
import type {
	Module,
	ModuleContext,
	ModuleControllers,
	ModuleDataService,
	ModuleStatus,
	Session,
} from "@86d-app/core/types/module";

/**
 * Per-module state tracked by the registry.
 */
export interface ModuleEntry {
	module: Module;
	status: ModuleStatus;
	/** Database UUID for this module record (set after boot) */
	dbId: string | undefined;
	/** Module-scoped data service (set after boot) */
	dataService: ModuleDataService | undefined;
	/** Owner-local atomic state and durable-event seam (set after boot) */
	transactions: ModuleTransactionRunner | undefined;
	/** Controllers owned by this module; never shared with another module context. */
	controllers: ModuleControllers;
	/** Error captured during init, if any */
	error: Error | undefined;
}

interface RegisteredCapabilityProvider {
	moduleId: string;
	provider: CapabilityProvider<AnyCapabilityDefinition>;
}

/** A configuration error detected before any Store or Module adapter is called. */
export class CapabilityContractError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CapabilityContractError";
	}
}

/**
 * Health snapshot returned by `getHealth()`.
 */
export interface RegistryHealth {
	status: "ready" | "booting" | "stopped" | "error";
	modules: Array<{
		id: string;
		status: ModuleStatus;
		error: string | undefined;
	}>;
	bootedAt: number | undefined;
	uptimeMs: number | undefined;
}

export interface ModuleRegistryConfig {
	/**
	 * Function to resolve a store identifier to its database UUID.
	 */
	resolveStoreId: (storeId: string) => Promise<string>;
	/**
	 * Function to upsert a module record and return the database UUID.
	 */
	upsertModuleRecord: (params: {
		storeId: string;
		moduleId: string;
		version: string;
		// biome-ignore lint/suspicious/noExplicitAny: module options can be any primitive record
		options: Record<string, any> | undefined;
	}) => Promise<string>;
	/**
	 * Factory to create a data service for a module.
	 *
	 * `moduleId` is the logical Module package ID and is the durable-event source
	 * identity. `moduleDbId` is the persisted `Module` row UUID used for
	 * owner-scoped foreign keys. They are distinct values and are never
	 * interchangeable: substituting one for the other silently breaks the durable
	 * event ownership guard and violates the outbox foreign key.
	 */
	createDataService: (params: {
		storeId: string;
		moduleId: string;
		moduleDbId: string;
	}) => ModuleDataService;
	/**
	 * Factory for the Module's owner-local transaction runner. A host that can
	 * commit state and durable events in one database transaction supplies this;
	 * a host without transactional storage omits it and Modules observe
	 * `ctx.transactions === undefined`.
	 */
	createTransactionRunner?:
		| ((params: {
				storeId: string;
				moduleId: string;
				moduleDbId: string;
		  }) => ModuleTransactionRunner)
		| undefined;
	/**
	 * Optional writer for `core.party` / `core.subject` / `core.transaction`.
	 * Money-owning Modules receive it on `ctx.coreMoney`.
	 */
	createCoreMoneyWriter?:
		| (() => NonNullable<ModuleContext["coreMoney"]>)
		| undefined;
	/**
	 * Event bus options.
	 */
	eventBusOptions?: EventBusOptions | undefined;
}

/**
 * Topological sort of modules so dependencies are initialized before dependents.
 * Falls back to original order for modules without dependency relationships.
 */
function topologicalSort(
	modules: Module[],
	capabilityDependencies: ReadonlyMap<string, ReadonlySet<string>>,
): Module[] {
	const moduleMap = new Map<string, Module>();
	for (const mod of modules) {
		moduleMap.set(mod.id, mod);
	}

	const visited = new Set<string>();
	// Marking a module visited on entry rather than on exit hides a cycle: the
	// second visit returns early and the module is ordered before the dependency
	// it is waiting on, so boot succeeds and a capability resolves against a
	// half-initialized provider. Tracking the current path turns that into an error.
	const visiting = new Set<string>();
	const result: Module[] = [];

	function visit(mod: Module, path: string[]) {
		if (visited.has(mod.id)) return;
		if (visiting.has(mod.id)) {
			const cycle = [...path.slice(path.indexOf(mod.id)), mod.id].join(" → ");
			throw new Error(`Circular module dependency detected: ${cycle}`);
		}
		visiting.add(mod.id);

		// Visit dependencies first
		const deps = getRequiredModuleIds(mod.requires);
		for (const dependencyId of capabilityDependencies.get(mod.id) ?? []) {
			deps.push(dependencyId);
		}
		for (const depId of deps) {
			const dep = moduleMap.get(depId);
			if (dep) visit(dep, [...path, mod.id]);
		}

		visiting.delete(mod.id);
		visited.add(mod.id);
		result.push(mod);
	}

	for (const mod of modules) {
		visit(mod, []);
	}

	return result;
}

// A consumer may accept several versions of one capability name while it
// migrates. Keying a binding by name alone lets the last resolved acceptance
// overwrite the earlier one, so which binding survives depends on the order of
// the accepts array, and every invoke of the shadowed version fails as
// unavailable even though its provider is installed.
function capabilityBindingKey(
	moduleId: string,
	capability: string,
	version: string,
): string {
	return `${moduleId}\u0000${capability}\u0000${version}`;
}

function capabilityFailure(
	definition: AnyCapabilityDefinition,
	code: CapabilityKernelFailure["code"],
): CapabilityRejected<CapabilityKernelFailure> {
	return {
		ok: false,
		failure: {
			code,
			capability: definition.name,
			version: definition.version,
		},
	};
}

function requestOperation(request: unknown): string | undefined {
	if (
		typeof request !== "object" ||
		request === null ||
		!("operation" in request)
	) {
		return undefined;
	}
	return typeof request.operation === "string" ? request.operation : undefined;
}

/**
 * ModuleRegistry — boots modules once and creates cheap per-request contexts.
 *
 * Lifecycle:
 * 1. `new ModuleRegistry(modules, storeId, config)` — registers modules
 * 2. `await registry.boot()` — resolves store, upserts records, validates contracts,
 *    calls `init()`, wires events. Modules transition pending → ready.
 * 3. `registry.createRequestContext(moduleId, session)` — returns an isolated
 *    ModuleContext per request.
 *    No DB calls, no contract validation, no init. Just session injection.
 * 4. `await registry.shutdown()` — calls module `shutdown` hooks, cleans up.
 */
export class ModuleRegistry {
	private modules: Module[];
	private storeIdParam: string;
	private config: ModuleRegistryConfig;
	private moduleOptions: Record<string, Record<string, Primitive>>;

	private entries: Map<string, ModuleEntry> = new Map();
	private controllers: ModuleControllers = {};
	private capabilityBindings = new Map<string, RegisteredCapabilityProvider>();
	private capabilityDependencies = new Map<string, Set<string>>();
	private resolvedStoreId: string | undefined;
	private endpointExposures: EndpointExposureEntry[] = [];
	private eventBus: EventBus | undefined;
	private bootedAt: number | undefined;
	private booted = false;
	private shuttingDown = false;

	constructor(
		modules: Module[],
		storeId: string,
		config: ModuleRegistryConfig,
		moduleOptions?: Record<string, Record<string, Primitive>>,
	) {
		this.modules = modules;
		this.storeIdParam = storeId;
		this.config = config;
		this.moduleOptions = moduleOptions ?? {};

		// Register all modules as pending
		for (const mod of modules) {
			this.entries.set(mod.id, {
				module: mod,
				status: "pending",
				dbId: undefined,
				dataService: undefined,
				transactions: undefined,
				controllers: { ...(mod.controllers ?? {}) },
				error: undefined,
			});
		}
	}

	private getModuleOptions(moduleId: string): Record<string, Primitive> {
		const module = this.entries.get(moduleId)?.module;
		return {
			...(module?.options ?? {}),
			...(this.moduleOptions[`@86d-app/${moduleId}`] ?? {}),
			...(this.moduleOptions[moduleId] ?? {}),
		};
	}

	/**
	 * Resolve all capability contracts without touching Store or Module adapters.
	 * The resulting bindings are immutable for the lifetime of this boot.
	 */
	private preflightCapabilities(): void {
		this.capabilityBindings.clear();
		this.capabilityDependencies.clear();

		const providersByName = new Map<string, RegisteredCapabilityProvider[]>();
		const errors: string[] = [];
		const moduleIds = new Set<string>();

		for (const mod of this.modules) {
			if (moduleIds.has(mod.id)) {
				errors.push(`Module ID "${mod.id}" is declared more than once.`);
				continue;
			}
			moduleIds.add(mod.id);
			for (const provider of mod.capabilities?.provides ?? []) {
				const definition = provider.definition;
				if (definition.owner !== mod.id) {
					errors.push(
						`Module "${mod.id}" cannot provide "${definition.name}" owned by "${definition.owner}".`,
					);
					continue;
				}
				if (!definition.name || !definition.version) {
					errors.push(`Module "${mod.id}" declares an unnamed capability.`);
					continue;
				}

				const registered: RegisteredCapabilityProvider = {
					moduleId: mod.id,
					provider,
				};
				const providers = providersByName.get(definition.name) ?? [];
				providers.push(registered);
				providersByName.set(definition.name, providers);
			}
		}

		for (const consumer of this.modules) {
			// Accepting one capability name at two versions is how a consumer
			// migrates, and bindings are keyed by version, so only an overlapping
			// version is ambiguous. Rejecting the name outright refused a legitimate
			// migration and stopped the whole runtime from booting.
			const acceptedVersions = new Map<string, Set<string>>();
			for (const acceptance of consumer.capabilities?.accepts ?? []) {
				if (
					acceptance.name !== acceptance.definition.name ||
					acceptance.owner !== acceptance.definition.owner ||
					!acceptance.versions.includes(acceptance.definition.version)
				) {
					errors.push(
						`Module "${consumer.id}" declares inconsistent metadata for capability "${acceptance.name}".`,
					);
					continue;
				}
				const seenVersions =
					acceptedVersions.get(acceptance.name) ?? new Set<string>();
				const overlapping = acceptance.versions.filter((version) =>
					seenVersions.has(version),
				);
				if (overlapping.length > 0) {
					errors.push(
						`Module "${consumer.id}" accepts "${acceptance.name}" version ${overlapping.join(", ")} more than once.`,
					);
					continue;
				}
				for (const version of acceptance.versions) seenVersions.add(version);
				acceptedVersions.set(acceptance.name, seenVersions);

				const versions = new Set(acceptance.versions);
				if (
					versions.size === 0 ||
					versions.size !== acceptance.versions.length
				) {
					errors.push(
						`Module "${consumer.id}" must accept one or more unique versions of "${acceptance.name}".`,
					);
					continue;
				}
				if (acceptance.operations) {
					const operations = new Set(acceptance.operations);
					if (
						operations.size === 0 ||
						operations.size !== acceptance.operations.length ||
						acceptance.operations.some(
							(operation) =>
								typeof operation !== "string" || operation.length === 0,
						)
					) {
						errors.push(
							`Module "${consumer.id}" must accept one or more unique operations of "${acceptance.name}".`,
						);
						continue;
					}
				}

				const namedProviders = providersByName.get(acceptance.name) ?? [];
				const compatible = namedProviders.filter(
					({ provider }) =>
						provider.definition.owner === acceptance.owner &&
						versions.has(provider.definition.version),
				);

				if (compatible.length === 0) {
					if (acceptance.optional && namedProviders.length === 0) continue;
					const reason =
						namedProviders.length === 0
							? "is missing"
							: "has no compatible version";
					errors.push(
						`Required capability "${acceptance.name}" for Module "${consumer.id}" ${reason}; accepted versions: ${[...versions].join(", ")}.`,
					);
					continue;
				}

				if (compatible.length > 1) {
					errors.push(
						`Required capability "${acceptance.name}" for Module "${consumer.id}" has ${compatible.length} compatible providers; exactly one is required.`,
					);
					continue;
				}

				const provider = compatible[0];
				if (!provider) continue;
				this.capabilityBindings.set(
					capabilityBindingKey(
						consumer.id,
						acceptance.name,
						provider.provider.definition.version,
					),
					provider,
				);
				const dependencies =
					this.capabilityDependencies.get(consumer.id) ?? new Set<string>();
				if (provider.moduleId !== consumer.id) {
					dependencies.add(provider.moduleId);
				}
				this.capabilityDependencies.set(consumer.id, dependencies);
			}
		}

		if (errors.length > 0) {
			throw new CapabilityContractError(
				`Capability contract violations:\n${errors.map((error) => `  - ${error}`).join("\n")}`,
			);
		}
	}

	private createCapabilityInvoker(moduleId: string): CapabilityInvoker {
		return {
			invoke: (definition, request) =>
				this.invokeCapability(moduleId, definition, request),
		};
	}

	private async invokeCapability<D extends AnyCapabilityDefinition>(
		consumerId: string,
		definition: D,
		request: CapabilityRequest<D>,
	): Promise<
		CapabilityResult<
			CapabilityDecision<D>,
			CapabilityFailure<D> | CapabilityKernelFailure
		>
	> {
		const acceptance = this.entries
			.get(consumerId)
			?.module.capabilities?.accepts?.find(
				(candidate) => candidate.definition === definition,
			);
		if (
			!acceptance ||
			acceptance.name !== definition.name ||
			acceptance.owner !== definition.owner ||
			!acceptance.versions.includes(definition.version)
		) {
			return capabilityFailure(definition, "CAPABILITY_NOT_ACCEPTED");
		}

		const registered = this.capabilityBindings.get(
			capabilityBindingKey(consumerId, definition.name, definition.version),
		);
		if (
			!registered ||
			registered.provider.definition.name !== acceptance.name ||
			registered.provider.definition.owner !== acceptance.owner ||
			!acceptance.versions.includes(registered.provider.definition.version)
		) {
			return capabilityFailure(definition, "CAPABILITY_UNAVAILABLE");
		}

		const consumerRequest = definition.request.safeParse(request);
		if (!consumerRequest.success) {
			return capabilityFailure(definition, "INVALID_CAPABILITY_REQUEST");
		}
		if (
			acceptance.operations &&
			!acceptance.operations.includes(
				requestOperation(consumerRequest.data) ?? "",
			)
		) {
			return capabilityFailure(definition, "CAPABILITY_OPERATION_NOT_ACCEPTED");
		}
		const providerRequest = registered.provider.definition.request.safeParse(
			consumerRequest.data,
		);
		if (!providerRequest.success) {
			return capabilityFailure(definition, "INVALID_CAPABILITY_REQUEST");
		}

		const providerEntry = this.entries.get(registered.moduleId);
		if (!providerEntry?.dataService || providerEntry.status !== "ready") {
			return capabilityFailure(definition, "CAPABILITY_UNAVAILABLE");
		}

		try {
			const result = await registered.provider.handle(
				{
					data: providerEntry.dataService,
					transactions: providerEntry.transactions,
					events:
						this.eventBus === undefined
							? undefined
							: createScopedEmitter(this.eventBus, registered.moduleId),
					storeId: this.resolvedStoreId ?? this.storeIdParam,
					options: this.getModuleOptions(registered.moduleId),
				},
				providerRequest.data,
			);

			if (result.ok) {
				const providerDecision =
					registered.provider.definition.decision.safeParse(result.decision);
				const consumerDecision = definition.decision.safeParse(result.decision);
				if (!providerDecision.success || !consumerDecision.success) {
					return capabilityFailure(definition, "INVALID_CAPABILITY_DECISION");
				}
				return {
					ok: true,
					decision: consumerDecision.data as CapabilityDecision<D>,
				};
			}

			const providerFailure = registered.provider.definition.failure.safeParse(
				result.failure,
			);
			const consumerFailure = definition.failure.safeParse(result.failure);
			if (!providerFailure.success || !consumerFailure.success) {
				return capabilityFailure(definition, "INVALID_CAPABILITY_FAILURE");
			}
			return {
				ok: false,
				failure: consumerFailure.data as CapabilityFailure<D>,
			};
		} catch (error) {
			// Without this the caller sees CAPABILITY_PROVIDER_FAILED whether the
			// provider rejected the request or crashed, and the stack is gone.
			console.error(
				`[86d] capability ${definition.name}@${definition.version} threw in provider ${registered.moduleId}:`,
				error,
			);
			return capabilityFailure(definition, "CAPABILITY_PROVIDER_FAILED");
		}
	}

	/**
	 * Boot the registry. Resolves store, validates contracts, initializes modules.
	 * Must be called exactly once. Subsequent calls are no-ops.
	 */
	async boot(): Promise<void> {
		if (this.booted) {
			return;
		}

		this.preflightCapabilities();

		const pathConflicts = validateUniquePaths(this.modules);
		if (pathConflicts.length > 0) {
			const messages = formatPathConflicts(pathConflicts);
			throw new Error(
				`Module path conflicts:\n${messages.map((m) => `  - ${m}`).join("\n")}`,
			);
		}

		const violations = validateContracts(this.modules);
		if (violations.length > 0) {
			const messages = formatViolations(violations);
			throw new Error(
				`Module contract violations:\n${messages.map((m) => `  - ${m}`).join("\n")}`,
			);
		}

		// An endpoint whose reachability cannot be resolved is not served. The
		// alternative is guessing from its path, which is how a provider webhook
		// gets treated as a shopper endpoint.
		const exposures = collectEndpointExposures(this.modules);
		if (exposures.violations.length > 0) {
			const messages = formatEndpointExposureViolations(exposures.violations);
			throw new Error(
				`Module endpoint exposure violations:\n${messages.map((m) => `  - ${m}`).join("\n")}`,
			);
		}
		this.endpointExposures = exposures.entries;

		// Resolve store ID
		this.resolvedStoreId = await this.config.resolveStoreId(this.storeIdParam);

		// Create shared event bus
		this.eventBus = createEventBus(this.config.eventBusOptions);

		const initializedModules: string[] = [];
		const failedModules = new Set<string>();

		// Topological sort: initialize dependencies before dependents
		const sorted = topologicalSort(this.modules, this.capabilityDependencies);

		// Immutable Store-level context values shared by all Modules. Every
		// resource-bearing value is added to a fresh, owner-scoped context below.
		const contextBase = {
			modules: this.modules.map((m) => m.id),
			storeId: this.resolvedStoreId,
		};

		for (const mod of sorted) {
			const entry = this.entries.get(mod.id);
			if (!entry) continue;

			entry.status = "initializing";

			try {
				// Check dependencies are initialized
				const requiredIds = [
					...new Set([
						...getRequiredModuleIds(mod.requires),
						...(this.capabilityDependencies.get(mod.id) ?? []),
					]),
				];
				for (const requiredId of requiredIds) {
					if (failedModules.has(requiredId)) {
						throw new Error(
							`Module "${mod.id}" requires "${requiredId}" which failed to initialize.`,
						);
					}
					if (!initializedModules.includes(requiredId)) {
						throw new Error(
							`Module "${mod.id}" requires "${requiredId}" but it was not initialized. ` +
								`Ensure "${requiredId}" appears before "${mod.id}" in your modules array.`,
						);
					}
				}

				// Upsert module record in DB
				const dbId = await this.config.upsertModuleRecord({
					storeId: this.resolvedStoreId,
					moduleId: mod.id,
					version: mod.version,
					options: mod.options
						? (mod.options as Record<string, Primitive>)
						: undefined,
				});
				entry.dbId = dbId;

				// Create the owner-scoped data seam. The logical Module ID and the
				// persisted row UUID are both supplied and are not interchangeable.
				const identity = {
					storeId: this.resolvedStoreId,
					moduleId: mod.id,
					moduleDbId: dbId,
				};
				const dataService = this.config.createDataService(identity);
				entry.dataService = dataService;
				entry.transactions = this.config.createTransactionRunner?.(identity);

				// Wire event handlers
				if (mod.events?.handles) {
					for (const [eventType, handler] of Object.entries(
						mod.events.handles,
					)) {
						this.eventBus.on(eventType, handler);
					}
				}

				// Create scoped emitter for this module
				const scopedEmitter = createScopedEmitter(this.eventBus, mod.id);
				const moduleContext: ModuleContext = {
					...contextBase,
					data: dataService,
					options: this.getModuleOptions(mod.id),
					events: scopedEmitter,
					controllers: entry.controllers,
					capabilities: this.createCapabilityInvoker(mod.id),
					transactions: entry.transactions,
					coreMoney: this.config.createCoreMoneyWriter?.(),
				};

				// Call init
				if (mod.init) {
					const initResult = await mod.init(moduleContext);

					if (initResult?.controllers) {
						Object.assign(entry.controllers, initResult.controllers);
					}
				}

				// Retain a compatibility inspection surface without exposing it to Modules.
				Object.assign(this.controllers, entry.controllers);

				entry.status = "ready";
				initializedModules.push(mod.id);
			} catch (err) {
				entry.status = "error";
				entry.error = err instanceof Error ? err : new Error(String(err));
				failedModules.add(mod.id);
				// Continue booting remaining modules — degraded operation is
				// better than a complete startup failure.
			}
		}

		if (initializedModules.length === 0) {
			throw new Error(
				"All modules failed to initialize. Cannot start the store.",
			);
		}

		this.booted = true;
		this.bootedAt = Date.now();
	}

	/**
	 * Create a lightweight per-request context.
	 * No DB calls, no contract validation, no init — just session injection.
	 * The registry must be booted first.
	 */
	createRequestContext(
		moduleId: string,
		session?: Session | null | undefined,
	): ModuleContext {
		if (!this.booted) {
			throw new Error("ModuleRegistry has not been booted. Call boot() first.");
		}
		if (this.shuttingDown) {
			throw new Error("ModuleRegistry is shutting down.");
		}
		if (!this.resolvedStoreId) {
			throw new Error("Store ID not resolved. Boot may have failed.");
		}

		const entry = this.entries.get(moduleId);
		if (entry?.status !== "ready" || !entry.dataService) {
			throw new Error(`Module "${moduleId}" is not initialized.`);
		}

		return {
			data: entry.dataService,
			modules: this.modules.map((m) => m.id),
			options: this.getModuleOptions(moduleId),
			session,
			controllers: entry.controllers,
			capabilities: this.createCapabilityInvoker(moduleId),
			transactions: entry.transactions,
			coreMoney: this.config.createCoreMoneyWriter?.(),
			storeId: this.resolvedStoreId,
			events: this.eventBus
				? createScopedEmitter(this.eventBus, moduleId)
				: undefined,
		};
	}

	/**
	 * Gracefully shut down all modules.
	 * Calls each module's `shutdown` hook in reverse init order.
	 */
	async shutdown(): Promise<void> {
		if (!this.booted || this.shuttingDown) {
			return;
		}
		this.shuttingDown = true;

		// Shutdown in reverse order
		const reversed = [...this.modules].reverse();

		for (const mod of reversed) {
			const entry = this.entries.get(mod.id);
			if (entry?.status !== "ready") continue;

			if (mod.shutdown && entry.dataService && this.resolvedStoreId) {
				try {
					const scopedEmitter = this.eventBus
						? createScopedEmitter(this.eventBus, mod.id)
						: undefined;

					await mod.shutdown({
						data: entry.dataService,
						modules: this.modules.map((m) => m.id),
						options: this.getModuleOptions(mod.id),
						controllers: entry.controllers,
						capabilities: this.createCapabilityInvoker(mod.id),
						transactions: entry.transactions,
						storeId: this.resolvedStoreId,
						events: scopedEmitter,
					});
				} catch {
					// Swallow shutdown errors — best-effort cleanup
				}
			}

			entry.status = "stopped";
		}

		// Clean up event bus
		if (this.eventBus) {
			this.eventBus.removeAllListeners();
		}

		this.booted = false;
	}

	/**
	 * Health snapshot of the registry and all modules.
	 */
	getHealth(): RegistryHealth {
		const moduleHealth = [...this.entries.values()].map((entry) => ({
			id: entry.module.id,
			status: entry.status,
			error: entry.error?.message,
		}));

		let status: RegistryHealth["status"];
		if (this.shuttingDown || (!this.booted && this.bootedAt !== undefined)) {
			status = "stopped";
		} else if (!this.booted) {
			status = "booting";
		} else if (moduleHealth.some((m) => m.status === "error")) {
			status = "error";
		} else {
			status = "ready";
		}

		return {
			status,
			modules: moduleHealth,
			bootedAt: this.bootedAt,
			uptimeMs: this.bootedAt ? Date.now() - this.bootedAt : undefined,
		};
	}

	/**
	 * Whether the registry has been booted and is ready to serve requests.
	 */
	isReady(): boolean {
		return this.booted && !this.shuttingDown;
	}

	/**
	 * Get the status of a specific module.
	 */
	getModuleStatus(moduleId: string): ModuleStatus | undefined {
		return this.entries.get(moduleId)?.status;
	}

	/**
	 * Get all registered module IDs.
	 */
	getModuleIds(): string[] {
		return this.modules.map((m) => m.id);
	}

	/**
	 * Get the merged controllers object.
	 */
	getControllers(): ModuleControllers {
		return this.controllers;
	}

	/**
	 * Get the shared event bus (only available after boot).
	 */
	getEventBus(): EventBus | undefined {
		return this.eventBus;
	}

	/**
	 * Persisted `Module` row UUID for a ready Module. Distinct from the logical
	 * Module ID; used for owner-scoped foreign keys.
	 */
	/**
	 * Declared exposure for every registered endpoint, resolved at boot.
	 * The request path is never consulted to derive this.
	 */
	getEndpointExposures(): readonly EndpointExposureEntry[] {
		return this.endpointExposures;
	}

	getModuleDbId(moduleId: string): string | undefined {
		const entry = this.entries.get(moduleId);
		return entry?.status === "ready" ? entry.dbId : undefined;
	}

	/**
	 * Durable event consumers declared by Modules that booted successfully.
	 *
	 * A Module that failed to initialize contributes nothing: its data service
	 * does not exist, so delivering to it could not commit. Those events stay in
	 * the outbox and are delivered once the Module boots.
	 */
	getDurableEventConsumers(): AnyDurableEventConsumer[] {
		const consumers: AnyDurableEventConsumer[] = [];
		const seen = new Set<string>();
		for (const mod of this.modules) {
			if (this.entries.get(mod.id)?.status !== "ready") continue;
			for (const consumer of mod.durableEvents?.handles ?? []) {
				if (consumer.owner !== mod.id) {
					throw new Error(
						`Module "${mod.id}" cannot register durable consumer "${consumer.consumer}" owned by "${consumer.owner}".`,
					);
				}
				if (seen.has(consumer.consumer)) {
					throw new Error(
						`Duplicate durable event consumer "${consumer.consumer}".`,
					);
				}
				seen.add(consumer.consumer);
				consumers.push(consumer);
			}
		}
		return consumers;
	}
}
