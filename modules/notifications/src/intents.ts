import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { z } from "zod";

const identifier = z.string().trim().min(1).max(500);
const timestamp = z
	.union([z.date(), z.string().datetime()])
	.transform((value) => (value instanceof Date ? value : new Date(value)));
const intentPayload = z
	.record(z.string().min(1).max(100), z.unknown())
	.refine((payload) => Object.keys(payload).length <= 50, {
		message: "Notification intent payloads may contain at most 50 keys.",
	});

export const notificationIntentInputSchema = z
	.object({
		idempotencyKey: identifier,
		sourceEventId: identifier,
		sourceModule: z.string().trim().min(1).max(100),
		templateKey: z.string().trim().min(1).max(200),
		channel: z.literal("email"),
		recipient: z.string().trim().email().max(320),
		deliveryMode: z.enum(["local", "managed_gateway"]),
		connectionId: identifier.optional(),
		payload: intentPayload,
	})
	.strict()
	.superRefine((intent, context) => {
		if (
			intent.deliveryMode === "managed_gateway" &&
			intent.connectionId === undefined
		) {
			context.addIssue({
				code: "custom",
				message:
					"Managed notification delivery requires a Communications Connection.",
				path: ["connectionId"],
			});
		}
	});

const storedNotificationIntentSchema = z
	.object({
		id: z.string().min(1).max(100),
		idempotencyKey: identifier,
		requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
		sourceEventId: identifier,
		sourceModule: z.string().min(1).max(100),
		templateKey: z.string().min(1).max(200),
		channel: z.literal("email"),
		recipient: z.string().email().max(320),
		deliveryMode: z.enum(["local", "managed_gateway"]),
		connectionId: identifier.optional(),
		payload: intentPayload,
		status: z.enum(["pending", "dispatching", "accepted", "failed", "blocked"]),
		attempts: z.number().int().nonnegative(),
		acceptedRecipientUnits: z.number().int().nonnegative(),
		providerMessageId: z.string().max(500).optional(),
		lastError: z.string().max(2_000).optional(),
		acceptedAt: timestamp.optional(),
		createdAt: timestamp,
		updatedAt: timestamp,
	})
	.strict()
	.superRefine((intent, context) => {
		if (
			intent.deliveryMode === "managed_gateway" &&
			intent.connectionId === undefined
		) {
			context.addIssue({
				code: "custom",
				message:
					"Managed notification delivery requires a Communications Connection.",
				path: ["connectionId"],
			});
		}
	});

export type NotificationIntentInput = z.infer<
	typeof notificationIntentInputSchema
>;
export type NotificationIntent = z.infer<typeof storedNotificationIntentSchema>;

export type NotificationIntentEnqueueResult =
	| { ok: true; intent: NotificationIntent; replayed: boolean }
	| {
			ok: false;
			code:
				| "IDEMPOTENCY_KEY_REUSED"
				| "INTENT_STATE_INVALID"
				| "LOCKING_UNAVAILABLE";
			message: string;
	  };

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function rejected(
	code: Extract<NotificationIntentEnqueueResult, { ok: false }>["code"],
	message: string,
): NotificationIntentEnqueueResult {
	return { ok: false, code, message };
}

function canonicalJson(value: unknown): string {
	if (value === null) return "null";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new Error("Notification intent payload numbers must be finite.");
		}
		return JSON.stringify(value);
	}
	if (value instanceof Date) return JSON.stringify(value.toISOString());
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	if (typeof value === "object") {
		const entries = Object.entries(value).sort(([left], [right]) =>
			left.localeCompare(right),
		);
		return `{${entries
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(",")}}`;
	}
	throw new Error("Notification intent payloads must be JSON-compatible.");
}

async function sha256(value: string): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function requestSignature(input: NotificationIntentInput): string {
	return canonicalJson([
		input.sourceEventId,
		input.sourceModule,
		input.templateKey,
		input.channel,
		input.recipient,
		input.deliveryMode,
		input.connectionId ?? null,
		input.payload,
	]);
}

export function createNotificationIntentStore(
	transactions: ModuleTransactionRunner,
): {
	enqueue(
		input: NotificationIntentInput,
	): Promise<NotificationIntentEnqueueResult>;
} {
	return {
		async enqueue(input) {
			const request = notificationIntentInputSchema.parse(input);
			const id = `notification_intent_${await sha256(request.idempotencyKey)}`;
			const requestFingerprint = await sha256(requestSignature(request));

			return transactions.transaction(async (transaction) => {
				if (!isLockingTransaction(transaction)) {
					return rejected(
						"LOCKING_UNAVAILABLE",
						"Notification intent creation requires owner-local row locking.",
					);
				}

				const now = new Date();
				await transaction.upsert("notificationIntentLock", id, {
					id,
					updatedAt: now,
				});
				const lock = await transaction.getForUpdate(
					"notificationIntentLock",
					id,
				);
				if (!lock) {
					return rejected(
						"LOCKING_UNAVAILABLE",
						"Notification intent creation could not acquire its owner-local lock.",
					);
				}

				const existing = await transaction.getForUpdate(
					"notificationIntent",
					id,
				);
				if (existing) {
					const parsed = storedNotificationIntentSchema.safeParse(existing);
					if (!parsed.success) {
						return rejected(
							"INTENT_STATE_INVALID",
							"The stored notification intent is invalid.",
						);
					}
					if (parsed.data.requestFingerprint !== requestFingerprint) {
						return rejected(
							"IDEMPOTENCY_KEY_REUSED",
							"The idempotency key was already used for a different notification intent.",
						);
					}
					return { ok: true, intent: parsed.data, replayed: true };
				}

				const intent = {
					id,
					idempotencyKey: request.idempotencyKey,
					requestFingerprint,
					sourceEventId: request.sourceEventId,
					sourceModule: request.sourceModule,
					templateKey: request.templateKey,
					channel: request.channel,
					recipient: request.recipient,
					deliveryMode: request.deliveryMode,
					...(request.connectionId
						? { connectionId: request.connectionId }
						: {}),
					payload: request.payload,
					status: "pending",
					attempts: 0,
					acceptedRecipientUnits: 0,
					createdAt: now,
					updatedAt: now,
				} satisfies NotificationIntent;

				await transaction.upsert("notificationIntent", id, intent);
				return { ok: true, intent, replayed: false };
			});
		},
	};
}
