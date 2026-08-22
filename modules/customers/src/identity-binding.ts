import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const sanitizedRequiredText = (maximum: number) =>
	z
		.string()
		.max(maximum)
		.transform(sanitizeText)
		.pipe(z.string().min(1).max(maximum));

const sanitizedOptionalText = (maximum: number) =>
	z
		.string()
		.max(maximum)
		.transform(sanitizeText)
		.pipe(z.string().min(1).max(maximum))
		.optional();

const timestampSchema = z
	.union([z.date(), z.string().datetime()])
	.transform((value) => (value instanceof Date ? value : new Date(value)));

const verifiedEmailSchema = z
	.string()
	.max(320)
	.transform(sanitizeText)
	.pipe(z.string().email().max(320))
	.transform((email) => email.toLowerCase());

export const storeCustomerIdentityInputSchema = z
	.object({
		identity: z
			.object({
				provider: z
					.string()
					.trim()
					.min(1)
					.max(100)
					.regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/)
					.transform((provider) => provider.toLowerCase()),
				subject: z.string().trim().min(1).max(255),
				email: verifiedEmailSchema,
				emailVerified: z.boolean(),
				firstName: sanitizedOptionalText(200),
				lastName: sanitizedOptionalText(200),
			})
			.strict(),
		audit: z
			.object({
				source: z.enum(["storefront", "store_admin", "workload", "system"]),
				correlationId: sanitizedRequiredText(255),
			})
			.strict(),
	})
	.strict();

export const storeCustomerAuditBindingSchema = z
	.object({
		principal: z
			.object({
				type: z.literal("verified_auth_identity"),
				provider: z.string().min(1).max(100),
				subjectDigest: z.string().regex(SHA256_PATTERN),
			})
			.strict(),
		source: z.enum(["storefront", "store_admin", "workload", "system"]),
		correlationId: z.string().min(1).max(255),
	})
	.strict();

export const storeCustomerAuthBindingSchema = z
	.object({
		id: z.string().min(1).max(100),
		bindingVersion: z.literal(1),
		customerId: z.string().min(1).max(100),
		authProvider: z.string().min(1).max(100),
		authSubjectDigest: z.string().regex(SHA256_PATTERN),
		verifiedEmail: z.string().email().max(320),
		customerCreated: z.boolean(),
		auditBinding: storeCustomerAuditBindingSchema,
		boundAt: timestampSchema,
	})
	.strict();

const storeCustomerRecordSchema = z
	.object({
		id: z.string().min(1).max(100),
		email: z.string().email().max(320),
		firstName: z.string().max(200),
		lastName: z.string().max(200),
		phone: z.string().max(50).optional(),
		dateOfBirth: timestampSchema.optional(),
		tags: z.array(z.string()).optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		createdAt: timestampSchema,
		updatedAt: timestampSchema,
	})
	.strict();

export type StoreCustomerIdentityInput = z.infer<
	typeof storeCustomerIdentityInputSchema
>;
export type StoreCustomerAuditBinding = z.infer<
	typeof storeCustomerAuditBindingSchema
>;
export type StoreCustomerAuthBinding = z.infer<
	typeof storeCustomerAuthBindingSchema
>;
export type StoreCustomer = z.infer<typeof storeCustomerRecordSchema>;

export type StoreCustomerResolutionResult =
	| {
			ok: true;
			customer: StoreCustomer;
			binding: StoreCustomerAuthBinding;
			createdCustomer: boolean;
			createdBinding: boolean;
	  }
	| {
			ok: false;
			code:
				| "INVALID_IDENTITY_INPUT"
				| "AUTH_IDENTITY_UNVERIFIED"
				| "TRANSACTION_UNAVAILABLE"
				| "LOCKING_UNAVAILABLE"
				| "AUTH_IDENTITY_CONFLICT"
				| "CUSTOMER_STATE_INVALID";
			message: string;
	  };

export type StoreCustomerIdentityService = {
	resolveOrCreate(
		input: StoreCustomerIdentityInput,
	): Promise<StoreCustomerResolutionResult>;
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
	code: Extract<StoreCustomerResolutionResult, { ok: false }>["code"],
	message: string,
): StoreCustomerResolutionResult {
	return { ok: false, code, message };
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

function normalizedEmail(value: string): string {
	return value.trim().toLowerCase();
}

async function acquireLocks(
	transaction: LockingModuleDataTransaction,
	lockIds: string[],
): Promise<boolean> {
	const orderedLockIds = [...lockIds].sort();
	for (const id of orderedLockIds) {
		await transaction.upsert("storeCustomerIdentityLock", id, { id });
	}
	for (const id of orderedLockIds) {
		const lock = await transaction.getForUpdate(
			"storeCustomerIdentityLock",
			id,
		);
		if (!lock) return false;
	}
	return true;
}

async function readBoundCustomer(
	transaction: LockingModuleDataTransaction,
	binding: StoreCustomerAuthBinding,
	email: string,
): Promise<StoreCustomerResolutionResult> {
	if (binding.verifiedEmail !== email) {
		return rejected(
			"AUTH_IDENTITY_CONFLICT",
			"The authentication identity is already bound to a different verified email.",
		);
	}

	const storedCustomer = await transaction.getForUpdate(
		"customer",
		binding.customerId,
	);
	const customer = storeCustomerRecordSchema.safeParse(storedCustomer);
	if (
		!customer.success ||
		normalizedEmail(customer.data.email) !== binding.verifiedEmail
	) {
		return rejected(
			"CUSTOMER_STATE_INVALID",
			"The bound Store Customer is missing or invalid.",
		);
	}

	return {
		ok: true,
		customer: customer.data,
		binding,
		createdCustomer: false,
		createdBinding: false,
	};
}

async function findCustomerByVerifiedEmail(
	transaction: LockingModuleDataTransaction,
	email: string,
): Promise<
	| { ok: true; customer: StoreCustomer | null }
	| {
			ok: false;
			code: Extract<StoreCustomerResolutionResult, { ok: false }>["code"];
			message: string;
	  }
> {
	const candidates = (await transaction.findMany("customer", {})).filter(
		(record) =>
			typeof record.email === "string" &&
			normalizedEmail(record.email) === email,
	);
	if (candidates.length > 1) {
		return {
			ok: false,
			code: "CUSTOMER_STATE_INVALID",
			message: "Multiple Store Customers use the same normalized email.",
		};
	}
	const candidate = candidates[0];
	if (!candidate) return { ok: true, customer: null };

	const parsedCandidate = storeCustomerRecordSchema.safeParse(candidate);
	if (!parsedCandidate.success) {
		return {
			ok: false,
			code: "CUSTOMER_STATE_INVALID",
			message: "The matching Store Customer is invalid.",
		};
	}
	const storedCustomer = await transaction.getForUpdate(
		"customer",
		parsedCandidate.data.id,
	);
	const customer = storeCustomerRecordSchema.safeParse(storedCustomer);
	if (!customer.success || normalizedEmail(customer.data.email) !== email) {
		return {
			ok: false,
			code: "CUSTOMER_STATE_INVALID",
			message: "The matching Store Customer changed during resolution.",
		};
	}
	return { ok: true, customer: customer.data };
}

async function ensureCustomerIsUnbound(
	transaction: LockingModuleDataTransaction,
	customerId: string,
): Promise<Extract<StoreCustomerResolutionResult, { ok: false }> | null> {
	const existingBindings = await transaction.findMany(
		"storeCustomerAuthBinding",
		{ where: { customerId } },
	);
	if (existingBindings.length === 0) return null;
	if (
		existingBindings.length !== 1 ||
		!storeCustomerAuthBindingSchema.safeParse(existingBindings[0]).success
	) {
		return {
			ok: false,
			code: "CUSTOMER_STATE_INVALID",
			message: "The Store Customer authentication binding is invalid.",
		};
	}
	return {
		ok: false,
		code: "AUTH_IDENTITY_CONFLICT",
		message: "The verified email belongs to an already-bound Store Customer.",
	};
}

async function resolveLocked(
	transaction: LockingModuleDataTransaction,
	input: StoreCustomerIdentityInput,
	subjectDigest: string,
	bindingId: string,
): Promise<StoreCustomerResolutionResult> {
	const emailDigest = await sha256(
		`store-customer-email:v1:${input.identity.email}`,
	);
	const locksAcquired = await acquireLocks(transaction, [
		`identity_${subjectDigest}`,
		`email_${emailDigest}`,
	]);
	if (!locksAcquired) {
		return rejected(
			"LOCKING_UNAVAILABLE",
			"The Store Customer identity locks could not be acquired.",
		);
	}

	const storedBinding = await transaction.getForUpdate(
		"storeCustomerAuthBinding",
		bindingId,
	);
	if (storedBinding) {
		const binding = storeCustomerAuthBindingSchema.safeParse(storedBinding);
		if (!binding.success) {
			return rejected(
				"CUSTOMER_STATE_INVALID",
				"The Store Customer authentication binding is invalid.",
			);
		}
		if (
			binding.data.authProvider !== input.identity.provider ||
			binding.data.authSubjectDigest !== subjectDigest
		) {
			return rejected(
				"AUTH_IDENTITY_CONFLICT",
				"The authentication identity binding does not match this principal.",
			);
		}
		return readBoundCustomer(transaction, binding.data, input.identity.email);
	}

	const foundCustomer = await findCustomerByVerifiedEmail(
		transaction,
		input.identity.email,
	);
	if (!foundCustomer.ok) return foundCustomer;

	let customer = foundCustomer.customer;
	let createdCustomer = false;
	if (customer) {
		const bindingFailure = await ensureCustomerIsUnbound(
			transaction,
			customer.id,
		);
		if (bindingFailure) return bindingFailure;
	} else {
		const customerHash = await sha256(`store-customer:v1:${bindingId}`);
		const customerId = `store_customer_${customerHash}`;
		const collidingCustomer = await transaction.getForUpdate(
			"customer",
			customerId,
		);
		if (collidingCustomer) {
			return rejected(
				"CUSTOMER_STATE_INVALID",
				"The deterministic Store Customer identity is already occupied.",
			);
		}

		const now = new Date();
		customer = {
			id: customerId,
			email: input.identity.email,
			firstName: input.identity.firstName ?? "",
			lastName: input.identity.lastName ?? "",
			metadata: {},
			createdAt: now,
			updatedAt: now,
		} satisfies StoreCustomer;
		await transaction.upsert("customer", customerId, customer);
		createdCustomer = true;
	}

	const now = new Date();
	const auditBinding = {
		principal: {
			type: "verified_auth_identity",
			provider: input.identity.provider,
			subjectDigest,
		},
		source: input.audit.source,
		correlationId: input.audit.correlationId,
	} satisfies StoreCustomerAuditBinding;
	const binding = {
		id: bindingId,
		bindingVersion: 1,
		customerId: customer.id,
		authProvider: input.identity.provider,
		authSubjectDigest: subjectDigest,
		verifiedEmail: input.identity.email,
		customerCreated: createdCustomer,
		auditBinding,
		boundAt: now,
	} satisfies StoreCustomerAuthBinding;

	await transaction.upsert("storeCustomerAuthBinding", bindingId, binding);
	return {
		ok: true,
		customer,
		binding,
		createdCustomer,
		createdBinding: true,
	};
}

/**
 * Resolves one verified authentication principal to one Store-owned Customer.
 * Raw authentication subjects are digested and never used as Customer IDs.
 * Guest Order claims are deliberately outside this service: they require an
 * Orders-owned capability that validates the scoped guest proof.
 */
export function createStoreCustomerIdentityService(
	transactions: ModuleTransactionRunner | undefined,
): StoreCustomerIdentityService {
	return {
		async resolveOrCreate(input) {
			const parsed = storeCustomerIdentityInputSchema.safeParse(input);
			if (!parsed.success) {
				return rejected(
					"INVALID_IDENTITY_INPUT",
					"The authentication identity input is invalid.",
				);
			}
			if (!parsed.data.identity.emailVerified) {
				return rejected(
					"AUTH_IDENTITY_UNVERIFIED",
					"A verified authentication identity is required.",
				);
			}
			if (!transactions) {
				return rejected(
					"TRANSACTION_UNAVAILABLE",
					"Store Customer resolution requires owner-local transactional storage.",
				);
			}

			const subjectDigest = await sha256(
				`store-customer-auth-subject:v1:${parsed.data.identity.provider}:${parsed.data.identity.subject}`,
			);
			const bindingId = `customer_auth_binding_${subjectDigest}`;
			return transactions.transaction((transaction) => {
				if (!isLockingTransaction(transaction)) {
					return Promise.resolve(
						rejected(
							"LOCKING_UNAVAILABLE",
							"Store Customer resolution requires owner-local row locking.",
						),
					);
				}
				return resolveLocked(
					transaction,
					parsed.data,
					subjectDigest,
					bindingId,
				);
			});
		},
	};
}
