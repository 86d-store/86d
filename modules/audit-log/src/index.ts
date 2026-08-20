import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import {
	INVENTORY_STOCK_ADJUSTED_CONSUMER,
	inventoryStockAdjustedAudit,
} from "./durable-consumers";
import { auditLogStorage } from "./schema";
import { createAuditLogController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ActorType,
	AuditAction,
	AuditEntry,
	AuditListParams,
	AuditLogController,
	AuditSummary,
	CreateAuditEntryParams,
} from "./service";
export { INVENTORY_STOCK_ADJUSTED_CONSUMER, inventoryStockAdjustedAudit };

export interface AuditLogOptions extends ModuleConfig {
	/**
	 * Number of days to retain audit entries before auto-purge.
	 * Set to 0 to disable auto-purge.
	 * @default 0
	 */
	retentionDays?: number;
}

/**
 * Audit log module factory function.
 * Records admin actions, system events, and API key usage for
 * security auditing, compliance, and accountability.
 *
 * Other modules can record audit entries by importing the AuditLogController
 * through inter-module contracts.
 */
export default function auditLog(options?: AuditLogOptions): Module {
	return {
		id: "audit-log",
		version: "0.0.1",
		storage: auditLogStorage,
		exports: {
			read: ["auditAction", "auditResource", "auditActorId"],
		},
		events: {
			emits: ["audit-log.entry.created", "audit-log.purged"],
		},
		// Delivered from the Inventory outbox, not the in-memory bus: the audit
		// record and its dedupe receipt commit in the delivery transaction, so a
		// crash between the stock change and the audit entry cannot lose it.
		durableEvents: { handles: [inventoryStockAdjustedAudit] },

		init: async (ctx: ModuleContext) => {
			const controller = createAuditLogController(ctx.data);
			return {
				controllers: { "audit-log": controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/audit-log",
					component: "AuditLogList",
					label: "Audit Log",
					icon: "ClipboardText",
					group: "System",
				},
				{
					path: "/admin/audit-log/:id",
					component: "AuditLogDetail",
				},
			],
		},

		options,
	};
}
