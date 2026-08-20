import type { ModuleController } from "@86d-app/core/types/module";

export type AuditAction =
	| "create"
	| "update"
	| "delete"
	| "bulk_create"
	| "bulk_update"
	| "bulk_delete"
	| "login"
	| "logout"
	| "export"
	| "import"
	| "settings_change"
	| "status_change"
	| "custom";

export type ActorType = "admin" | "system" | "api_key";

export type AuditEntry = {
	id: string;
	action: AuditAction;
	resource: string;
	resourceId?: string | undefined;
	actorId?: string | undefined;
	actorEmail?: string | undefined;
	actorType: ActorType;
	description: string;
	changes?: Record<string, unknown> | undefined;
	metadata?: Record<string, unknown> | undefined;
	ipAddress?: string | undefined;
	userAgent?: string | undefined;
	createdAt: Date;
};

export type CreateAuditEntryParams = {
	action: AuditAction;
	resource: string;
	resourceId?: string | undefined;
	actorId?: string | undefined;
	actorEmail?: string | undefined;
	actorType?: ActorType | undefined;
	description: string;
	changes?: Record<string, unknown> | undefined;
	metadata?: Record<string, unknown> | undefined;
	ipAddress?: string | undefined;
	userAgent?: string | undefined;
};

export type AuditListParams = {
	action?: AuditAction | undefined;
	resource?: string | undefined;
	actorId?: string | undefined;
	actorType?: ActorType | undefined;
	dateFrom?: Date | undefined;
	dateTo?: Date | undefined;
	take?: number | undefined;
	skip?: number | undefined;
};

export type AuditSummary = {
	totalEntries: number;
	entriesByAction: Record<string, number>;
	entriesByResource: Record<string, number>;
	recentActors: Array<{
		actorId: string;
		actorEmail?: string | undefined;
		count: number;
	}>;
};

export type AuditLogController = ModuleController & {
	/**
	 * Record an audit entry.
	 */
	log(params: CreateAuditEntryParams): Promise<AuditEntry>;

	/**
	 * Get a single audit entry by ID.
	 */
	getById(id: string): Promise<AuditEntry | null>;

	/**
	 * List audit entries with filtering and pagination.
	 */
	list(
		params?: AuditListParams,
	): Promise<{ entries: AuditEntry[]; total: number }>;

	/**
	 * List audit entries for a specific resource instance.
	 */
	listForResource(
		resource: string,
		resourceId: string,
		params?: { take?: number | undefined; skip?: number | undefined },
	): Promise<AuditEntry[]>;

	/**
	 * List audit entries by a specific actor.
	 */
	listForActor(
		actorId: string,
		params?: { take?: number | undefined; skip?: number | undefined },
	): Promise<AuditEntry[]>;

	/**
	 * Get aggregate summary of audit activity.
	 */
	getSummary(params?: {
		dateFrom?: Date | undefined;
		dateTo?: Date | undefined;
	}): Promise<AuditSummary>;

	/**
	 * Purge audit entries older than a given date.
	 * Returns the number of entries deleted.
	 */
	purge(olderThan: Date): Promise<number>;
};
