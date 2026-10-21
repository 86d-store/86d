/**
 * Shared module registry boot logic for API routes.
 * Used by the catch-all API route and the store-markdown route.
 */

import type { Primitive } from "@86d-store/core/types/helper";
import type { Module } from "@86d-store/core/types/module";
import { CompiledModuleDataService } from "@86d-store/runtime/compiled-module-data-service";
import {
	applyCompiledModuleSchema,
	type CompiledSchemaBundle,
	compiledForModule,
	compileInstalledModules,
} from "@86d-store/runtime/compiled-schema-boot";
import { ModuleRegistry } from "@86d-store/runtime/registry";
import { getStoreConfig } from "@86d-store/sdk/get-store-config";
import { loadFromTemplate } from "@86d-store/sdk/load-from-template";
import type { Config } from "@86d-store/sdk/types";
import { db, getPool } from "db";
import { writeCoreMoney } from "db/core-money";
import { createPostgresTransactionalExecutor } from "db/schema/apply-disposable-ddl";
import { module } from "db/schema/tables";
import { and, eq } from "drizzle-orm";
import env from "env";
import { getProcessEnv } from "env/process-env";
import { logger } from "utils/logger";
import { modules } from "../generated/api";
import { resolveTemplatePath } from "./template-path";
import { registerWebhookHandlers } from "./webhook-subscriber";

function isPrimitive(v: unknown): v is Primitive {
	return (
		v === null ||
		v === undefined ||
		typeof v === "string" ||
		typeof v === "number" ||
		typeof v === "boolean" ||
		typeof v === "symbol" ||
		typeof v === "bigint"
	);
}

function toPrimitiveRecord(
	obj: Record<string, unknown>,
): Record<string, Primitive> {
	const result: Record<string, Primitive> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (isPrimitive(v)) result[k] = v;
	}
	return result;
}

let registry: ModuleRegistry | null = null;
let bootPromise: Promise<void> | null = null;
let subscribersRegistered = false;
let storeOwnedConfig: Config | null = null;
let compiledSchema: CompiledSchemaBundle | null = null;
let compiledSchemaApplyPromise: Promise<void> | null = null;

const moduleDataServices = new Map<string, CompiledModuleDataService>();

let lastBootFailureMs = 0;
let lastBootError: Error | null = null;

function getBootBackoffSeconds(): number {
	const configured = getProcessEnv("BOOT_FAILURE_BACKOFF_SECONDS");
	if (configured) {
		const parsed = Number.parseInt(configured, 10);
		if (!Number.isNaN(parsed) && parsed > 0) return parsed;
	}
	return 10;
}

async function ensureCompiledSchema(): Promise<CompiledSchemaBundle> {
	if (!compiledSchema) {
		compiledSchema = compileInstalledModules(modules as Module[]);
	}
	if (!compiledSchemaApplyPromise) {
		const pool = getPool();
		compiledSchemaApplyPromise = applyCompiledModuleSchema(
			createPostgresTransactionalExecutor(pool),
			compiledSchema,
		).catch((error) => {
			compiledSchemaApplyPromise = null;
			throw error;
		});
	}
	await compiledSchemaApplyPromise;
	return compiledSchema;
}

function moduleDataService(params: {
	storeId: string;
	moduleId: string;
	moduleDbId: string;
}): CompiledModuleDataService {
	if (!compiledSchema) {
		throw new Error("Compiled Module schema is not ready.");
	}
	const key = `${params.storeId}${params.moduleId}${params.moduleDbId}`;
	const existing = moduleDataServices.get(key);
	if (existing) return existing;
	const created = new CompiledModuleDataService({
		db,
		storeId: params.storeId,
		moduleId: params.moduleId,
		moduleDbId: params.moduleDbId,
		compiled: compiledForModule(compiledSchema, params.moduleId),
	});
	moduleDataServices.set(key, created);
	return created;
}

function getStoreOwnedConfig(): Config {
	if (!storeOwnedConfig) {
		storeOwnedConfig = loadFromTemplate(resolveTemplatePath());
	}
	return storeOwnedConfig;
}

function getStoreOwnedModuleOptions(): Record<
	string,
	Record<string, Primitive>
> {
	const result: Record<string, Record<string, Primitive>> = {};
	const moduleOptions = getStoreOwnedConfig().moduleOptions;
	if (!moduleOptions || typeof moduleOptions !== "object") {
		return result;
	}
	for (const [moduleId, options] of Object.entries(moduleOptions)) {
		if (options && typeof options === "object" && !Array.isArray(options)) {
			result[moduleId] = toPrimitiveRecord(options as Record<string, unknown>);
		}
	}
	return result;
}

function getRegistry(): ModuleRegistry {
	const storeId = env.STORE_ID;
	if (!storeId) {
		throw new Error("STORE_ID not configured");
	}
	if (!registry) {
		const platformOptions = getStoreOwnedModuleOptions();

		registry = new ModuleRegistry(
			modules,
			storeId,
			{
				resolveStoreId: async (id) => id,
				upsertModuleRecord: async (params) => {
					const existing = await db
						.select({ id: module.id })
						.from(module)
						.where(
							and(
								eq(module.storeId, params.storeId),
								eq(module.name, params.moduleId),
							),
						)
						.limit(1);
					if (existing[0]) {
						await db
							.update(module)
							.set({ version: params.version })
							.where(eq(module.id, existing[0].id));
						return existing[0].id;
					}
					const id = crypto.randomUUID();
					const cuid = `m${id.replace(/-/g, "").slice(0, 29)}`;
					await db.insert(module).values({
						id,
						cuid,
						name: params.moduleId,
						version: params.version,
						storeId: params.storeId,
						settings: params.options ?? null,
					});
					return id;
				},
				createDataService: (params) => moduleDataService(params),
				createTransactionRunner: (params) => moduleDataService(params),
				createCoreMoneyWriter: () => ({
					write: async (input) => {
						await writeCoreMoney(db, input);
					},
				}),
			},
			platformOptions,
		);
	}
	return registry;
}

export class BootFailureError extends Error {
	override readonly cause: Error;
	readonly retryAfterSeconds: number;

	constructor(message: string, cause: Error, retryAfterSeconds: number) {
		super(message);
		this.name = "BootFailureError";
		this.cause = cause;
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

export async function ensureBooted(): Promise<ModuleRegistry> {
	const backoffSeconds = getBootBackoffSeconds();
	const now = Date.now();

	if (lastBootFailureMs > 0 && lastBootError) {
		const elapsedMs = now - lastBootFailureMs;
		const remainingMs = backoffSeconds * 1000 - elapsedMs;
		if (remainingMs > 0) {
			throw new BootFailureError(
				"Store boot failed; retry throttled",
				lastBootError,
				Math.ceil(remainingMs / 1000),
			);
		}
		lastBootFailureMs = 0;
		lastBootError = null;
	}

	try {
		await ensureCompiledSchema();
	} catch (err) {
		lastBootFailureMs = Date.now();
		lastBootError = err instanceof Error ? err : new Error(String(err));
		throw new BootFailureError(
			"Store boot failed during schema compilation",
			lastBootError,
			backoffSeconds,
		);
	}

	const reg = getRegistry();
	if (reg.isReady()) {
		return reg;
	}
	if (!bootPromise) {
		bootPromise = reg.boot().catch((err) => {
			registry = null;
			bootPromise = null;
			subscribersRegistered = false;
			lastBootFailureMs = Date.now();
			lastBootError = err instanceof Error ? err : new Error(String(err));
			throw err;
		});
	}

	try {
		await bootPromise;
	} catch (err) {
		throw new BootFailureError(
			"Store boot failed during registry boot",
			err instanceof Error ? err : new Error(String(err)),
			backoffSeconds,
		);
	}

	if (!subscribersRegistered) {
		const bus = reg.getEventBus();
		if (bus) {
			if (!getProcessEnv("RESEND_API_KEY")) {
				logger.debug("Email notifications disabled (RESEND_API_KEY not set)");
			} else {
				try {
					const [
						{ registerNotificationHandlers },
						{ default: resend },
						{
							parseNotificationSettings,
							isEventEnabled,
							NOTIFICATION_EVENT_TYPES,
						},
					] = await Promise.all([
						import("~/lib/notifications"),
						import("emails"),
						import("lib/notification-settings"),
					]);

					const storeId = env.STORE_ID;
					let storeName = "Our Store";
					let fromAddress: string | undefined;
					let adminEmail: string | undefined;
					let enabledEvents: Set<string> | undefined;

					if (storeId) {
						const config = await getStoreConfig({
							templatePath: resolveTemplatePath(),
						});
						storeName = config.name;
						const localNotificationSettings =
							getStoreOwnedConfig().notificationSettings;
						const settings = localNotificationSettings
							? parseNotificationSettings(localNotificationSettings)
							: {};
						if (settings.fromAddress) {
							fromAddress = settings.fromAddress;
						}
						if (settings.adminEmail) {
							adminEmail = settings.adminEmail;
						}
						if (settings.events && Object.keys(settings.events).length > 0) {
							enabledEvents = new Set<string>();
							for (const evt of NOTIFICATION_EVENT_TYPES) {
								if (isEventEnabled(settings, evt)) {
									enabledEvents.add(evt);
								}
							}
						}
					}

					registerNotificationHandlers(
						bus,
						resend,
						{
							storeName,
							fromAddress: fromAddress ?? `${storeName} <orders@86d.app>`,
							adminEmail,
						},
						enabledEvents,
					);
				} catch (err) {
					logger.warn("Email notifications failed", {
						reason: err instanceof Error ? err.message : String(err),
					});
				}
			}

			try {
				const storeId = env.STORE_ID;
				if (storeId) {
					registerWebhookHandlers(bus, db, storeId);
				}
			} catch (err) {
				logger.warn("Webhook delivery disabled", {
					reason: err instanceof Error ? err.message : String(err),
				});
			}
		}
		subscribersRegistered = true;
	}

	return reg;
}

export function resetBootStateForTest(): void {
	registry = null;
	bootPromise = null;
	subscribersRegistered = false;
	storeOwnedConfig = null;
	compiledSchema = null;
	compiledSchemaApplyPromise = null;
	moduleDataServices.clear();
	lastBootFailureMs = 0;
	lastBootError = null;
}
