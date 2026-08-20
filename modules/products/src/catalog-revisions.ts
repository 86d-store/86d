import {
	type ActorReference,
	type AuthoritySnapshot,
	actorReferenceSchema,
	authoritySnapshotSchema,
} from "@86d-app/core/commands";
import {
	catalogPublishedV1,
	type LockingModuleDataTransaction,
	type ModuleDataTransaction,
} from "@86d-app/core/durable-events";
import { isSafeUrl, sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

const resourceIdentifierSchema = z
	.string()
	.min(1)
	.max(200)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const operationIdentifierSchema = z
	.string()
	.min(8)
	.max(180)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const contentDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const dateTimeSchema = z.string().datetime();
const minorAmountSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const slugSchema = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const imageReferenceSchema = z
	.string()
	.min(1)
	.max(2_048)
	.transform(sanitizeText)
	.pipe(z.string().min(1).max(2_048).refine(isSafeUrl));
const metadataScalarSchema = z.union([
	z.string().max(2_000).transform(sanitizeText),
	z.number().finite(),
	z.boolean(),
	z.null(),
]);
const metadataValueSchema = z.union([
	metadataScalarSchema,
	z.array(metadataScalarSchema).max(100),
]);
const metadataSchema = z
	.record(
		z
			.string()
			.min(1)
			.max(100)
			.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
		metadataValueSchema,
	)
	.refine((metadata) => Object.keys(metadata).length <= 100, {
		message: "Catalog metadata cannot contain more than 100 keys.",
	});

export const catalogRevisionCategorySchema = z
	.object({
		id: resourceIdentifierSchema,
		name: z
			.string()
			.min(1)
			.max(500)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(500)),
		slug: slugSchema,
		description: z.string().max(20_000).transform(sanitizeText).optional(),
		parentId: resourceIdentifierSchema.optional(),
		image: imageReferenceSchema.optional(),
		position: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
		isVisible: z.boolean(),
		metadata: metadataSchema,
	})
	.strict();

export const catalogRevisionProductSchema = z
	.object({
		id: resourceIdentifierSchema,
		name: z
			.string()
			.min(1)
			.max(500)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(500)),
		slug: slugSchema,
		description: z.string().max(100_000).transform(sanitizeText).optional(),
		shortDescription: z.string().max(2_000).transform(sanitizeText).optional(),
		price: minorAmountSchema,
		compareAtPrice: minorAmountSchema.optional(),
		costPrice: minorAmountSchema.optional(),
		sku: z
			.string()
			.min(1)
			.max(255)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(255))
			.optional(),
		barcode: z
			.string()
			.min(1)
			.max(255)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(255))
			.optional(),
		status: z.enum(["draft", "active", "archived"]),
		categoryId: resourceIdentifierSchema.optional(),
		images: z.array(imageReferenceSchema).max(50),
		tags: z
			.array(
				z
					.string()
					.min(1)
					.max(100)
					.transform(sanitizeText)
					.pipe(z.string().min(1).max(100)),
			)
			.max(100),
		metadata: metadataSchema,
		weight: z.number().finite().nonnegative().optional(),
		weightUnit: z.enum(["kg", "lb", "oz", "g"]).optional(),
		isFeatured: z.boolean(),
	})
	.strict();

const variantOptionsSchema = z
	.record(
		z
			.string()
			.min(1)
			.max(100)
			.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
		z.string().max(500).transform(sanitizeText),
	)
	.refine((options) => Object.keys(options).length <= 50, {
		message: "A Variant cannot contain more than 50 option values.",
	});

export const catalogRevisionVariantSchema = z
	.object({
		id: resourceIdentifierSchema,
		productId: resourceIdentifierSchema,
		name: z
			.string()
			.min(1)
			.max(500)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(500)),
		sku: z
			.string()
			.min(1)
			.max(255)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(255))
			.optional(),
		barcode: z
			.string()
			.min(1)
			.max(255)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(255))
			.optional(),
		price: minorAmountSchema,
		compareAtPrice: minorAmountSchema.optional(),
		costPrice: minorAmountSchema.optional(),
		options: variantOptionsSchema,
		images: z.array(imageReferenceSchema).max(50),
		weight: z.number().finite().nonnegative().optional(),
		weightUnit: z.enum(["kg", "lb", "oz", "g"]).optional(),
		position: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
	})
	.strict();

function addDuplicateIssue(
	values: readonly string[],
	label: string,
	path: string,
	context: z.RefinementCtx,
): void {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) {
			context.addIssue({
				code: "custom",
				message: `${label} must be unique within a Catalog revision.`,
				path: [path],
			});
			return;
		}
		seen.add(value);
	}
}

export const catalogRevisionContentSchema = z
	.object({
		version: z.literal(1),
		currency: z.string().regex(/^[A-Z]{3}$/),
		categories: z.array(catalogRevisionCategorySchema).max(10_000),
		products: z.array(catalogRevisionProductSchema).max(25_000),
		variants: z.array(catalogRevisionVariantSchema).max(100_000),
	})
	.strict()
	.superRefine((content, context) => {
		addDuplicateIssue(
			content.categories.map((category) => category.id),
			"Category IDs",
			"categories",
			context,
		);
		addDuplicateIssue(
			content.categories.map((category) => category.slug),
			"Category slugs",
			"categories",
			context,
		);
		addDuplicateIssue(
			content.products.map((product) => product.id),
			"Product IDs",
			"products",
			context,
		);
		addDuplicateIssue(
			content.products.map((product) => product.slug),
			"Product slugs",
			"products",
			context,
		);
		addDuplicateIssue(
			content.variants.map((variant) => variant.id),
			"Variant IDs",
			"variants",
			context,
		);
		addDuplicateIssue(
			[
				...content.products.flatMap((product) =>
					product.sku === undefined ? [] : [product.sku],
				),
				...content.variants.flatMap((variant) =>
					variant.sku === undefined ? [] : [variant.sku],
				),
			],
			"SKUs",
			"products",
			context,
		);

		const categoryIds = new Set(
			content.categories.map((category) => category.id),
		);
		for (const [index, category] of content.categories.entries()) {
			if (
				category.parentId !== undefined &&
				(!categoryIds.has(category.parentId) ||
					category.parentId === category.id)
			) {
				context.addIssue({
					code: "custom",
					message:
						"Category parents must reference a different Category in the same revision.",
					path: ["categories", index, "parentId"],
				});
			}
		}

		const productIds = new Set(content.products.map((product) => product.id));
		for (const [index, product] of content.products.entries()) {
			if (
				product.categoryId !== undefined &&
				!categoryIds.has(product.categoryId)
			) {
				context.addIssue({
					code: "custom",
					message:
						"Product Categories must exist in the same Catalog revision.",
					path: ["products", index, "categoryId"],
				});
			}
		}
		for (const [index, variant] of content.variants.entries()) {
			if (!productIds.has(variant.productId)) {
				context.addIssue({
					code: "custom",
					message: "Variant Products must exist in the same Catalog revision.",
					path: ["variants", index, "productId"],
				});
			}
		}

		if (canonicalJson(content).length > 16_777_216) {
			context.addIssue({
				code: "custom",
				message: "Catalog revision content cannot exceed 16 MiB.",
			});
		}
	});

export const catalogRevisionStateSchema = z.enum([
	"draft",
	"reviewed",
	"published",
	"superseded",
	"failed",
]);

export const catalogRevisionRecordSchema = z
	.object({
		id: resourceIdentifierSchema,
		sequence: z.number().int().positive(),
		state: catalogRevisionStateSchema,
		baseRevisionId: resourceIdentifierSchema.optional(),
		contentVersion: z.literal(1),
		contentDigest: contentDigestSchema,
		content: catalogRevisionContentSchema,
		createdAt: dateTimeSchema,
		createdBy: actorReferenceSchema,
		createdAuthorityId: resourceIdentifierSchema,
		reviewedAt: dateTimeSchema.optional(),
		reviewedBy: actorReferenceSchema.optional(),
		reviewedAuthorityId: resourceIdentifierSchema.optional(),
		publishedAt: dateTimeSchema.optional(),
		publishedBy: actorReferenceSchema.optional(),
		publishedAuthorityId: resourceIdentifierSchema.optional(),
		supersededAt: dateTimeSchema.optional(),
		supersededByRevisionId: resourceIdentifierSchema.optional(),
		failedAt: dateTimeSchema.optional(),
		failedBy: actorReferenceSchema.optional(),
		failedAuthorityId: resourceIdentifierSchema.optional(),
		failedFromState: z.enum(["draft", "reviewed"]).optional(),
		failureReason: z.string().min(1).max(2_000).optional(),
	})
	.strict()
	.superRefine((revision, context) => {
		const reviewFields = [
			revision.reviewedAt,
			revision.reviewedBy,
			revision.reviewedAuthorityId,
		];
		const publishFields = [
			revision.publishedAt,
			revision.publishedBy,
			revision.publishedAuthorityId,
		];
		const supersedeFields = [
			revision.supersededAt,
			revision.supersededByRevisionId,
		];
		const failureFields = [
			revision.failedAt,
			revision.failedBy,
			revision.failedAuthorityId,
			revision.failedFromState,
			revision.failureReason,
		];
		const hasAll = (fields: readonly unknown[]) =>
			fields.every((field) => field !== undefined);
		const hasNone = (fields: readonly unknown[]) =>
			fields.every((field) => field === undefined);

		const valid =
			(revision.state === "draft" &&
				hasNone(reviewFields) &&
				hasNone(publishFields) &&
				hasNone(supersedeFields) &&
				hasNone(failureFields)) ||
			(revision.state === "reviewed" &&
				hasAll(reviewFields) &&
				hasNone(publishFields) &&
				hasNone(supersedeFields) &&
				hasNone(failureFields)) ||
			(revision.state === "published" &&
				hasAll(reviewFields) &&
				hasAll(publishFields) &&
				hasNone(supersedeFields) &&
				hasNone(failureFields)) ||
			(revision.state === "superseded" &&
				hasAll(reviewFields) &&
				hasAll(publishFields) &&
				hasAll(supersedeFields) &&
				hasNone(failureFields)) ||
			(revision.state === "failed" &&
				hasAll(failureFields) &&
				hasNone(publishFields) &&
				hasNone(supersedeFields) &&
				(revision.failedFromState === "reviewed"
					? hasAll(reviewFields)
					: hasNone(reviewFields)));

		if (!valid) {
			context.addIssue({
				code: "custom",
				message: "Catalog revision transition metadata is inconsistent.",
			});
		}
		if (revision.supersededByRevisionId === revision.id) {
			context.addIssue({
				code: "custom",
				message: "A Catalog revision cannot supersede itself.",
				path: ["supersededByRevisionId"],
			});
		}
	});

const catalogRevisionHeadSchema = z
	.object({
		id: z.literal("catalog"),
		nextSequence: z.number().int().positive(),
		publishedRevisionId: resourceIdentifierSchema.optional(),
		publishedContentDigest: contentDigestSchema.optional(),
		updatedAt: dateTimeSchema,
	})
	.strict()
	.superRefine((head, context) => {
		if (
			(head.publishedRevisionId === undefined) !==
			(head.publishedContentDigest === undefined)
		) {
			context.addIssue({
				code: "custom",
				message: "Catalog head revision and digest must be recorded together.",
			});
		}
	});

export const catalogDraftCommandInputSchema = z
	.object({
		operationId: operationIdentifierSchema,
		revisionId: resourceIdentifierSchema,
		baseRevisionId: resourceIdentifierSchema.optional(),
		content: catalogRevisionContentSchema,
	})
	.strict();

export const catalogTransitionCommandInputSchema = z
	.object({
		operationId: operationIdentifierSchema,
		revisionId: resourceIdentifierSchema,
		expectedContentDigest: contentDigestSchema,
	})
	.strict();

export const catalogTransitionTransportSchema = z
	.object({
		operationId: operationIdentifierSchema,
		expectedContentDigest: contentDigestSchema,
	})
	.strict();

export const catalogRevisionOperationInputSchema = z.discriminatedUnion(
	"action",
	[
		z
			.object({
				action: z.literal("create_draft"),
				operationId: operationIdentifierSchema,
				revisionId: resourceIdentifierSchema,
				baseRevisionId: resourceIdentifierSchema.optional(),
				content: catalogRevisionContentSchema,
			})
			.strict(),
		z
			.object({
				action: z.literal("review"),
				operationId: operationIdentifierSchema,
				revisionId: resourceIdentifierSchema,
				expectedContentDigest: contentDigestSchema,
			})
			.strict(),
		z
			.object({
				action: z.literal("publish"),
				operationId: operationIdentifierSchema,
				revisionId: resourceIdentifierSchema,
				expectedContentDigest: contentDigestSchema,
			})
			.strict(),
		z
			.object({
				action: z.literal("fail"),
				operationId: operationIdentifierSchema,
				revisionId: resourceIdentifierSchema,
				expectedContentDigest: contentDigestSchema,
				reason: z
					.string()
					.min(1)
					.max(2_000)
					.transform(sanitizeText)
					.pipe(z.string().min(1).max(2_000)),
			})
			.strict(),
	],
);

const catalogRevisionOperationContextSchema = z
	.object({
		actor: actorReferenceSchema,
		authority: authoritySnapshotSchema,
		occurredAt: z.date(),
		commandExecutionId: resourceIdentifierSchema.optional(),
	})
	.strict()
	.refine((context) => !Number.isNaN(context.occurredAt.getTime()), {
		message: "Catalog operation time must be valid.",
		path: ["occurredAt"],
	});

const catalogRevisionDecisionBaseSchema = z
	.object({
		operationId: operationIdentifierSchema,
		revisionId: resourceIdentifierSchema,
		revisionSequence: z.number().int().positive(),
		state: catalogRevisionStateSchema,
		baseRevisionId: resourceIdentifierSchema.optional(),
		contentDigest: contentDigestSchema,
		publishedAt: dateTimeSchema.optional(),
	})
	.strict();

export const catalogRevisionOperationDecisionSchema =
	catalogRevisionDecisionBaseSchema.extend({ replayed: z.boolean() }).strict();

const storedCatalogRevisionOperationSchema = z
	.object({
		id: operationIdentifierSchema,
		action: z.enum(["create_draft", "review", "publish", "fail"]),
		revisionId: resourceIdentifierSchema,
		requestDigest: contentDigestSchema,
		decision: catalogRevisionDecisionBaseSchema,
		createdAt: dateTimeSchema,
	})
	.strict();

export const catalogRevisionOperationFailureCodeSchema = z.enum([
	"invalid_request",
	"locking_unavailable",
	"idempotency_conflict",
	"revision_already_exists",
	"revision_not_found",
	"base_revision_required",
	"base_revision_not_found",
	"base_revision_invalid",
	"invalid_state",
	"content_mismatch",
	"stale_base_revision",
	"invalid_stored_state",
]);

export type CatalogRevisionContent = z.infer<
	typeof catalogRevisionContentSchema
>;
export type CatalogRevisionRecord = z.infer<typeof catalogRevisionRecordSchema>;
export type CatalogRevisionState = z.infer<typeof catalogRevisionStateSchema>;
export type CatalogRevisionOperationInput = z.infer<
	typeof catalogRevisionOperationInputSchema
>;
export type CatalogRevisionOperationDecision = z.infer<
	typeof catalogRevisionOperationDecisionSchema
>;
export type CatalogRevisionOperationFailureCode = z.infer<
	typeof catalogRevisionOperationFailureCodeSchema
>;
export type CatalogRevisionOperationContext = Readonly<{
	actor: ActorReference;
	authority: AuthoritySnapshot;
	occurredAt: Date;
	commandExecutionId?: string | undefined;
}>;
export type CatalogRevisionOperationResult =
	| Readonly<{ ok: true; decision: CatalogRevisionOperationDecision }>
	| Readonly<{
			ok: false;
			failure: Readonly<{
				code: CatalogRevisionOperationFailureCode;
				message: string;
				retryable: boolean;
			}>;
	  }>;

function rejected(
	code: CatalogRevisionOperationFailureCode,
	message: string,
	retryable = false,
): CatalogRevisionOperationResult {
	return { ok: false, failure: { code, message, retryable } };
}

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function canonicalJson(value: unknown): string {
	if (value === null) return "null";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new Error("Catalog revision numbers must be finite.");
		}
		return JSON.stringify(value);
	}
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
	throw new Error("Catalog revision content must be JSON-compatible.");
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

export async function digestCatalogRevisionContent(
	content: CatalogRevisionContent,
): Promise<string> {
	return sha256(`86d.catalog.revision.content.v1\0${canonicalJson(content)}`);
}

async function digestOperation(
	input: CatalogRevisionOperationInput,
	context: CatalogRevisionOperationContext,
	contentDigest?: string,
): Promise<string> {
	const operation =
		input.action === "create_draft"
			? [
					input.action,
					input.operationId,
					input.revisionId,
					input.baseRevisionId ?? null,
					contentDigest ?? null,
				]
			: input.action === "fail"
				? [
						input.action,
						input.operationId,
						input.revisionId,
						input.expectedContentDigest,
						input.reason,
					]
				: [
						input.action,
						input.operationId,
						input.revisionId,
						input.expectedContentDigest,
					];
	return sha256(
		`86d.catalog.revision.operation.v1\0${canonicalJson([
			operation,
			context.actor,
			context.authority.id,
		])}`,
	);
}

function emptyHead(occurredAt: string) {
	return {
		id: "catalog",
		nextSequence: 1,
		updatedAt: occurredAt,
	} satisfies z.input<typeof catalogRevisionHeadSchema>;
}

function decisionFor(
	operationId: string,
	revision: CatalogRevisionRecord,
	replayed: boolean,
): CatalogRevisionOperationDecision {
	return catalogRevisionOperationDecisionSchema.parse({
		operationId,
		revisionId: revision.id,
		revisionSequence: revision.sequence,
		state: revision.state,
		...(revision.baseRevisionId === undefined
			? {}
			: { baseRevisionId: revision.baseRevisionId }),
		contentDigest: revision.contentDigest,
		...(revision.publishedAt === undefined
			? {}
			: { publishedAt: revision.publishedAt }),
		replayed,
	});
}

async function appendAudit(
	transaction: LockingModuleDataTransaction,
	id: string,
	revisionId: string,
	fromState: CatalogRevisionState | undefined,
	toState: CatalogRevisionState,
	context: CatalogRevisionOperationContext,
): Promise<void> {
	await transaction.upsert("catalogRevisionAudit", id, {
		id,
		revisionId,
		...(fromState === undefined ? {} : { fromState }),
		toState,
		actor: context.actor,
		authorityId: context.authority.id,
		...(context.commandExecutionId === undefined
			? {}
			: { commandExecutionId: context.commandExecutionId }),
		occurredAt: context.occurredAt.toISOString(),
	});
}

async function persistSuccess(
	transaction: LockingModuleDataTransaction,
	input: CatalogRevisionOperationInput,
	requestDigest: string,
	revision: CatalogRevisionRecord,
	context: CatalogRevisionOperationContext,
): Promise<CatalogRevisionOperationResult> {
	const decision = decisionFor(input.operationId, revision, false);
	const stored = storedCatalogRevisionOperationSchema.parse({
		id: input.operationId,
		action: input.action,
		revisionId: input.revisionId,
		requestDigest,
		decision: {
			operationId: decision.operationId,
			revisionId: decision.revisionId,
			revisionSequence: decision.revisionSequence,
			state: decision.state,
			...(decision.baseRevisionId === undefined
				? {}
				: { baseRevisionId: decision.baseRevisionId }),
			contentDigest: decision.contentDigest,
			...(decision.publishedAt === undefined
				? {}
				: { publishedAt: decision.publishedAt }),
		},
		createdAt: context.occurredAt.toISOString(),
	});
	await transaction.upsert(
		"catalogRevisionOperation",
		input.operationId,
		stored,
	);
	return { ok: true, decision };
}

async function readRevision(
	transaction: LockingModuleDataTransaction,
	revisionId: string,
): Promise<CatalogRevisionRecord | null | "invalid"> {
	const stored = await transaction.getForUpdate("catalogRevision", revisionId);
	if (!stored) return null;
	const parsed = catalogRevisionRecordSchema.safeParse(stored);
	return parsed.success ? parsed.data : "invalid";
}

async function createDraft(
	transaction: LockingModuleDataTransaction,
	input: Extract<CatalogRevisionOperationInput, { action: "create_draft" }>,
	context: CatalogRevisionOperationContext,
	head: z.infer<typeof catalogRevisionHeadSchema>,
	requestDigest: string,
	contentDigest: string,
): Promise<CatalogRevisionOperationResult> {
	const existing = await transaction.getForUpdate(
		"catalogRevision",
		input.revisionId,
	);
	if (existing) {
		return rejected(
			"revision_already_exists",
			"The Catalog revision identity is already in use.",
		);
	}
	if (
		head.publishedRevisionId !== undefined &&
		input.baseRevisionId === undefined
	) {
		return rejected(
			"base_revision_required",
			"A new Catalog draft must record the published base revision.",
		);
	}
	if (
		head.publishedRevisionId === undefined &&
		input.baseRevisionId !== undefined
	) {
		return rejected(
			"invalid_stored_state",
			"A Catalog base revision exists without a published Catalog head.",
		);
	}
	if (input.baseRevisionId !== undefined) {
		const base = await readRevision(transaction, input.baseRevisionId);
		if (base === null) {
			return rejected(
				"base_revision_not_found",
				"The Catalog base revision was not found.",
			);
		}
		if (base === "invalid") {
			return rejected(
				"invalid_stored_state",
				"The Catalog base revision is malformed.",
			);
		}
		if (base.state !== "published" && base.state !== "superseded") {
			return rejected(
				"base_revision_invalid",
				"A Catalog base must be a published or superseded revision.",
			);
		}
	}

	const occurredAt = context.occurredAt.toISOString();
	const revision = catalogRevisionRecordSchema.parse({
		id: input.revisionId,
		sequence: head.nextSequence,
		state: "draft",
		...(input.baseRevisionId === undefined
			? {}
			: { baseRevisionId: input.baseRevisionId }),
		contentVersion: 1,
		contentDigest,
		content: input.content,
		createdAt: occurredAt,
		createdBy: context.actor,
		createdAuthorityId: context.authority.id,
	});
	await transaction.upsert("catalogRevision", revision.id, revision);
	await transaction.upsert(
		"catalogRevisionHead",
		"catalog",
		catalogRevisionHeadSchema.parse({
			...head,
			nextSequence: head.nextSequence + 1,
			updatedAt: occurredAt,
		}),
	);
	await appendAudit(
		transaction,
		input.operationId,
		revision.id,
		undefined,
		"draft",
		context,
	);
	return persistSuccess(transaction, input, requestDigest, revision, context);
}

async function transitionExisting(
	transaction: LockingModuleDataTransaction,
	input: Exclude<
		CatalogRevisionOperationInput,
		{ action: "create_draft" | "publish" }
	>,
	context: CatalogRevisionOperationContext,
	requestDigest: string,
): Promise<CatalogRevisionOperationResult> {
	const revision = await readRevision(transaction, input.revisionId);
	if (revision === null) {
		return rejected(
			"revision_not_found",
			"The Catalog revision was not found.",
		);
	}
	if (revision === "invalid") {
		return rejected(
			"invalid_stored_state",
			"The Catalog revision is malformed.",
		);
	}
	if (revision.contentDigest !== input.expectedContentDigest) {
		return rejected(
			"content_mismatch",
			"The Catalog revision content no longer matches the reviewed digest.",
		);
	}
	const occurredAt = context.occurredAt.toISOString();
	if (input.action === "review") {
		if (revision.state !== "draft") {
			return rejected(
				"invalid_state",
				"Only a draft Catalog revision can be reviewed.",
			);
		}
		const reviewed = catalogRevisionRecordSchema.parse({
			...revision,
			state: "reviewed",
			reviewedAt: occurredAt,
			reviewedBy: context.actor,
			reviewedAuthorityId: context.authority.id,
		});
		await transaction.upsert("catalogRevision", reviewed.id, reviewed);
		await appendAudit(
			transaction,
			input.operationId,
			reviewed.id,
			"draft",
			"reviewed",
			context,
		);
		return persistSuccess(transaction, input, requestDigest, reviewed, context);
	}

	if (revision.state !== "draft" && revision.state !== "reviewed") {
		return rejected(
			"invalid_state",
			"Only a draft or reviewed Catalog revision can fail.",
		);
	}
	const failedFromState = revision.state;
	const failed = catalogRevisionRecordSchema.parse({
		...revision,
		state: "failed",
		failedAt: occurredAt,
		failedBy: context.actor,
		failedAuthorityId: context.authority.id,
		failedFromState,
		failureReason: input.reason,
	});
	await transaction.upsert("catalogRevision", failed.id, failed);
	await appendAudit(
		transaction,
		input.operationId,
		failed.id,
		failedFromState,
		"failed",
		context,
	);
	return persistSuccess(transaction, input, requestDigest, failed, context);
}

async function publishRevision(
	transaction: LockingModuleDataTransaction,
	input: Extract<CatalogRevisionOperationInput, { action: "publish" }>,
	context: CatalogRevisionOperationContext,
	head: z.infer<typeof catalogRevisionHeadSchema>,
	requestDigest: string,
): Promise<CatalogRevisionOperationResult> {
	const revision = await readRevision(transaction, input.revisionId);
	if (revision === null) {
		return rejected(
			"revision_not_found",
			"The Catalog revision was not found.",
		);
	}
	if (revision === "invalid") {
		return rejected(
			"invalid_stored_state",
			"The Catalog revision is malformed.",
		);
	}
	if (revision.contentDigest !== input.expectedContentDigest) {
		return rejected(
			"content_mismatch",
			"The Catalog revision content no longer matches the reviewed digest.",
		);
	}
	if (revision.state !== "reviewed") {
		return rejected(
			"invalid_state",
			"Only a reviewed Catalog revision can publish.",
		);
	}
	if (revision.baseRevisionId !== head.publishedRevisionId) {
		return rejected(
			"stale_base_revision",
			"The published Catalog changed after this revision was drafted.",
		);
	}

	const occurredAt = context.occurredAt.toISOString();
	if (head.publishedRevisionId !== undefined) {
		const previous = await readRevision(transaction, head.publishedRevisionId);
		if (
			previous === null ||
			previous === "invalid" ||
			previous.state !== "published" ||
			previous.contentDigest !== head.publishedContentDigest
		) {
			return rejected(
				"invalid_stored_state",
				"The published Catalog head is inconsistent.",
			);
		}
		const superseded = catalogRevisionRecordSchema.parse({
			...previous,
			state: "superseded",
			supersededAt: occurredAt,
			supersededByRevisionId: revision.id,
		});
		await transaction.upsert("catalogRevision", superseded.id, superseded);
		await appendAudit(
			transaction,
			`${input.operationId}:supersede`,
			superseded.id,
			"published",
			"superseded",
			context,
		);
	}

	const published = catalogRevisionRecordSchema.parse({
		...revision,
		state: "published",
		publishedAt: occurredAt,
		publishedBy: context.actor,
		publishedAuthorityId: context.authority.id,
	});
	await transaction.upsert("catalogRevision", published.id, published);
	await transaction.upsert(
		"catalogRevisionHead",
		"catalog",
		catalogRevisionHeadSchema.parse({
			...head,
			publishedRevisionId: published.id,
			publishedContentDigest: published.contentDigest,
			updatedAt: occurredAt,
		}),
	);
	await appendAudit(
		transaction,
		input.operationId,
		published.id,
		"reviewed",
		"published",
		context,
	);
	await transaction.emit(catalogPublishedV1, {
		aggregate: { type: "catalog", id: "catalog" },
		occurredAt: context.occurredAt,
		payload: {
			revisionId: published.id,
			revisionSequence: published.sequence,
			...(published.baseRevisionId === undefined
				? {}
				: { baseRevisionId: published.baseRevisionId }),
			contentVersion: 1,
			contentDigest: published.contentDigest,
			currency: published.content.currency,
			productCount: published.content.products.length,
			variantCount: published.content.variants.length,
			categoryCount: published.content.categories.length,
			operationId: input.operationId,
			actor: context.actor,
			authorityId: context.authority.id,
		},
	});
	return persistSuccess(transaction, input, requestDigest, published, context);
}

/**
 * Products-owned adapter for Catalog revision Commands. The caller supplies the
 * owner-local transaction used by Command persistence, so Command identity,
 * the state change, audit row, replay receipt, and `catalog.published@1`
 * outbox fact share one commit. HTTP is a thin Store Admin transport.
 */
export async function applyCatalogRevisionOperation(
	transaction: ModuleDataTransaction,
	rawInput: CatalogRevisionOperationInput,
	rawContext: CatalogRevisionOperationContext,
): Promise<CatalogRevisionOperationResult> {
	const parsedInput = catalogRevisionOperationInputSchema.safeParse(rawInput);
	const parsedContext =
		catalogRevisionOperationContextSchema.safeParse(rawContext);
	if (!parsedInput.success || !parsedContext.success) {
		return rejected(
			"invalid_request",
			"The Catalog revision operation is invalid.",
		);
	}
	if (typeof transaction.emit !== "function") {
		return rejected(
			"locking_unavailable",
			"Catalog revision operations require transactional durable events.",
			true,
		);
	}
	if (!isLockingTransaction(transaction)) {
		return rejected(
			"locking_unavailable",
			"Catalog revision operations require owner-local row locking.",
			true,
		);
	}

	const input = parsedInput.data;
	const context = parsedContext.data;
	const occurredAt = context.occurredAt.toISOString();
	const contentDigest =
		input.action === "create_draft"
			? await digestCatalogRevisionContent(input.content)
			: undefined;
	const requestDigest = await digestOperation(input, context, contentDigest);

	await transaction.upsert("catalogRevisionLock", "catalog", { id: "catalog" });
	const lock = await transaction.getForUpdate("catalogRevisionLock", "catalog");
	if (!lock) {
		return rejected(
			"locking_unavailable",
			"The Catalog revision lock could not be acquired.",
			true,
		);
	}

	const storedOperation = await transaction.getForUpdate(
		"catalogRevisionOperation",
		input.operationId,
	);
	if (storedOperation) {
		const parsedOperation =
			storedCatalogRevisionOperationSchema.safeParse(storedOperation);
		if (!parsedOperation.success) {
			return rejected(
				"invalid_stored_state",
				"The Catalog operation receipt is malformed.",
			);
		}
		if (parsedOperation.data.requestDigest !== requestDigest) {
			return rejected(
				"idempotency_conflict",
				"The Catalog operation identity was reused for different input.",
			);
		}
		return {
			ok: true,
			decision: catalogRevisionOperationDecisionSchema.parse({
				...parsedOperation.data.decision,
				replayed: true,
			}),
		};
	}

	const storedHead = await transaction.get("catalogRevisionHead", "catalog");
	const parsedHead = storedHead
		? catalogRevisionHeadSchema.safeParse(storedHead)
		: catalogRevisionHeadSchema.safeParse(emptyHead(occurredAt));
	if (!parsedHead.success) {
		return rejected(
			"invalid_stored_state",
			"The Catalog revision head is malformed.",
		);
	}

	if (input.action === "create_draft") {
		if (contentDigest === undefined) {
			return rejected(
				"invalid_request",
				"The Catalog content digest could not be created.",
			);
		}
		return createDraft(
			transaction,
			input,
			context,
			parsedHead.data,
			requestDigest,
			contentDigest,
		);
	}
	if (input.action === "publish") {
		return publishRevision(
			transaction,
			input,
			context,
			parsedHead.data,
			requestDigest,
		);
	}
	return transitionExisting(transaction, input, context, requestDigest);
}
