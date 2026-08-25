/**
 * Shared module registry boot logic for API routes.
 * Used by the catch-all API route and the store-markdown route.
 */

import type { Primitive } from "@86d-app/core/types/helper";
import type { Module } from "@86d-app/core/types/module";
import { CompiledModuleDataService } from "@86d-app/runtime/compiled-module-data-service";
import {
	applyCompiledModuleSchema,
	type CompiledSchemaBundle,
	compiledForModule,
	compileInstalledModules,
} from "@86d-app/runtime/compiled-schema-boot";
import { ModuleRegistry } from "@86d-app/runtime/registry";
import { getStoreConfig } from "@86d-app/sdk/get-store-config";
import { loadFromTemplate } from "@86d-app/sdk/load-from-template";
import type { Config } from "@86d-app/sdk/types";
import { db, getPool } from "db";
import { createPostgresTransactionalExecutor } from "db/schema/apply-disposable-ddl";
import { module } from "db/schema/tables";
import { and, eq } from "drizzle-orm";
import env from "env";
import { getProcessEnv } from "env/process-env";
import { logger } from "utils/logger";
import { modules } from "../generated/api";
import { resolveTemplatePath } from "./template-path";

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
						const { writeCoreMoney } = await import("db/core-money");
						await writeCoreMoney(db, input);
					},
				}),
			},
			platformOptions,
		);
	}
	return registry;
}

export async function ensureBooted(): Promise<ModuleRegistry> {
	await ensureCompiledSchema();
	const reg = getRegistry();
	if (reg.isReady()) {
		return reg;
	}
	if (!bootPromise) {
		bootPromise = reg.boot().catch((err) => {
			registry = null;
			bootPromise = null;
			subscribersRegistered = false;
			throw err;
		});
	}
	await bootPromise;

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
					const { registerWebhookHandlers } = await import(
						"~/lib/webhook-subscriber"
					);
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
