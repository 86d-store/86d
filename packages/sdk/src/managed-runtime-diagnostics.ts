import { readProcessEnv } from "env/process-env";
import { z } from "zod";
import {
	createWorkloadTokenClient,
	readManagedWorkloadConfig,
} from "./workload-token-client";

export const MANAGED_RUNTIME_DIAGNOSTICS_TELEMETRY =
	"managed-runtime-diagnostics-v1" as const;

const MANAGED_RUNTIME_DIAGNOSTICS_RESOURCE = {
	audience: "https://86d.app/api/store-runtime",
	scopes: ["runtime.telemetry:write"],
} as const;

const managedRuntimeCheckSchema = z
	.object({
		component: z.enum(["runtime", "database", "storage"]),
		status: z.enum(["ok", "degraded", "error"]),
	})
	.strict();

const managedRuntimeErrorSchema = z
	.object({
		category: z.enum([
			"configuration",
			"database",
			"storage",
			"dependency",
			"internal",
		]),
		occurrences: z.number().int().min(1).max(10_000),
	})
	.strict();

export const managedRuntimeDiagnosticsSchema = z
	.object({
		schemaVersion: z.literal(1),
		reportId: z.string().uuid(),
		observedAt: z.string().max(35).datetime({ offset: true }),
		health: z.enum(["healthy", "degraded", "unhealthy"]),
		runtimeVersion: z
			.string()
			.min(1)
			.max(64)
			.regex(/^[0-9]{1,5}\.[0-9]{1,5}\.[0-9]{1,5}(?:-[0-9A-Za-z.-]{1,32})?$/)
			.optional(),
		checks: z.array(managedRuntimeCheckSchema).max(16),
		errors: z.array(managedRuntimeErrorSchema).max(16),
	})
	.strict()
	.superRefine((diagnostics, context) => {
		const components = new Set<string>();
		for (const check of diagnostics.checks) {
			if (components.has(check.component)) {
				context.addIssue({
					code: "custom",
					path: ["checks"],
					message: "Diagnostics checks must have unique components",
				});
				return;
			}
			components.add(check.component);
		}
	});

export type ManagedRuntimeDiagnostics = z.infer<
	typeof managedRuntimeDiagnosticsSchema
>;

export interface ManagedRuntimeDiagnosticsClient {
	readonly enabled: boolean;
	report(
		diagnostics: ManagedRuntimeDiagnostics,
	): Promise<{ status: "accepted" | "disabled" }>;
}

export function createManagedRuntimeDiagnosticsClient(
	input: {
		environment?: Record<string, string | undefined> | undefined;
		fetch?: typeof globalThis.fetch | undefined;
	} = {},
): ManagedRuntimeDiagnosticsClient {
	const environment = input.environment ?? readProcessEnv();
	const enabled =
		environment["86D_TELEMETRY"] === MANAGED_RUNTIME_DIAGNOSTICS_TELEMETRY;
	let client: ReturnType<typeof createWorkloadTokenClient> | undefined;
	if (enabled) {
		try {
			const config = readManagedWorkloadConfig(environment);
			if (!config) throw new Error("missing configuration");
			client = createWorkloadTokenClient({
				config,
				...(input.fetch ? { fetch: input.fetch } : {}),
			});
		} catch {
			throw new Error("Managed Runtime diagnostics configuration is invalid");
		}
	}
	return {
		enabled,
		async report(diagnostics) {
			const payload = managedRuntimeDiagnosticsSchema.safeParse(diagnostics);
			if (!payload.success) {
				throw new Error("Managed Runtime diagnostics payload is invalid");
			}
			if (!client) return { status: "disabled" };
			try {
				const response = await client.request(
					MANAGED_RUNTIME_DIAGNOSTICS_RESOURCE,
					"v1/workloads/diagnostics",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload.data),
						cache: "no-store",
						redirect: "error",
					},
				);
				if (!response.ok) throw new Error("request rejected");
				const body = (await response.json()) as unknown;
				if (
					!body ||
					typeof body !== "object" ||
					Array.isArray(body) ||
					Object.keys(body).length !== 1 ||
					(body as { status?: unknown }).status !== "accepted"
				) {
					throw new Error("invalid response");
				}
				return { status: "accepted" };
			} catch {
				throw new Error("Managed Runtime diagnostics request failed");
			}
		},
	};
}
