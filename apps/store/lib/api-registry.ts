/**
 * Shared module registry boot logic for API routes.
 * Used by the catch-all API route and the store-markdown route.
 */

import type { Primitive } from "@86d-app/core/types/helper";
import { ModuleRegistry } from "@86d-app/runtime/registry";
import { UniversalDataService } from "@86d-app/runtime/universal-data-service";
import { getStoreConfig } from "@86d-app/sdk/get-store-config";
import { loadFromTemplate } from "@86d-app/sdk/load-from-template";
import type { Config } from "@86d-app/sdk/types";
import { db, Prisma } from "db";
import env from "env";
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

/**
 * One owner-scoped data service per booted Module.
 *
 * `moduleId` is the logical Module package ID and carries durable-event source
 * identity; `moduleDbId` is the persisted `Module` row UUID used for
 * owner-scoped foreign keys. Passing the UUID as the logical ID breaks the
 * durable-event ownership guard and violates the outbox foreign key, so both
 * are forwarded explicitly.
 */
const moduleDataServices = new Map<string, UniversalDataService>();

function moduleDataService(params: {
	storeId: string;
	moduleId: string;
	moduleDbId: string;
}): UniversalDataService {
	const key = `${params.storeId}${params.moduleId}${params.moduleDbId}`;
	const existing = moduleDataServices.get(key);
	if (existing) return existing;
	const created = new UniversalDataService({
		db,
		storeId: params.storeId,
		moduleId: params.moduleId,
		moduleDbId: params.moduleDbId,
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
		// Module options are Store-owned runtime configuration. Managed and legacy
		// Control Plane responses cannot change Module behavior at this seam.
		const platformOptions = getStoreOwnedModuleOptions();

		registry = new ModuleRegistry(
			modules,
			storeId,
			{
				resolveStoreId: async (id) => id,
				upsertModuleRecord: async (params) => {
					const record = await db.module.upsert({
						where: {
							storeId_name: {
								storeId: params.storeId,
								name: params.moduleId,
							},
						},
						create: {
							name: params.moduleId,
							version: params.version,
							storeId: params.storeId,
							// Write factory defaults on first creation only. User-configured
							// settings (saved via the dashboard) must not be overwritten on
							// subsequent boots — only the version is updated on UPDATE.
							settings: params.options
								? JSON.stringify(params.options)
								: Prisma.JsonNull,
						},
						update: {
							version: params.version,
						},
					});
					return record.id;
				},
				createDataService: (params) => moduleDataService(params),
				// The same owner-scoped service is the transaction runner, so state
				// and its durable events commit through one database transaction.
				createTransactionRunner: (params) => moduleDataService(params),
			},
			platformOptions,
		);
	}
	return registry;
}

export async function ensureBooted(): Promise<ModuleRegistry> {
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
			// Email notifications
			if (!process.env.RESEND_API_KEY) {
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
						import("./notifications"),
						import("emails"),
						import("lib/notification-settings"),
					]);

					const storeId = env.STORE_ID;
					let storeName = "Our Store";
					let fromAddress: string | undefined;
					let adminEmail: string | undefined;
					let enabledEvents: Set<string> | undefined;

					if (storeId) {
						// The workload identity names the Store; a caller-supplied id
						// would let a request choose whose configuration it reads.
						const config = await getStoreConfig({
							templatePath: resolveTemplatePath(),
						});
						storeName = config.name ?? "Our Store";
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

			// Webhook delivery
			try {
				const storeId = env.STORE_ID;
				if (storeId) {
					const { registerWebhookHandlers } = await import(
						"./webhook-subscriber"
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
