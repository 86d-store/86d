import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import {
	type CatalogRevisionRecord,
	catalogDraftCommandInputSchema,
	catalogRevisionRecordSchema,
	catalogRevisionStateSchema,
	catalogTransitionTransportSchema,
} from "../../catalog-revisions";

const resourceIdentifierSchema = z
	.string()
	.min(1)
	.max(200)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

function revisionSummary(revision: CatalogRevisionRecord) {
	return {
		id: revision.id,
		sequence: revision.sequence,
		state: revision.state,
		...(revision.baseRevisionId === undefined
			? {}
			: { baseRevisionId: revision.baseRevisionId }),
		contentVersion: revision.contentVersion,
		contentDigest: revision.contentDigest,
		currency: revision.content.currency,
		productCount: revision.content.products.length,
		variantCount: revision.content.variants.length,
		categoryCount: revision.content.categories.length,
		createdAt: revision.createdAt,
		...(revision.reviewedAt === undefined
			? {}
			: { reviewedAt: revision.reviewedAt }),
		...(revision.publishedAt === undefined
			? {}
			: { publishedAt: revision.publishedAt }),
		...(revision.supersededAt === undefined
			? {}
			: { supersededAt: revision.supersededAt }),
		...(revision.failedAt === undefined ? {} : { failedAt: revision.failedAt }),
	};
}

function commandTransportRequired() {
	return {
		code: "CATALOG_COMMAND_TRANSPORT_REQUIRED",
		error:
			"Catalog revision writes must be executed by the authenticated Store Command transport.",
		status: 503,
	};
}

export const createCatalogRevisionDraft = createAdminEndpoint(
	"/admin/catalog/revisions/create",
	{ method: "POST", body: catalogDraftCommandInputSchema },
	async () => commandTransportRequired(),
);

export const reviewCatalogRevision = createAdminEndpoint(
	"/admin/catalog/revisions/:id/review",
	{
		method: "POST",
		params: z.object({ id: resourceIdentifierSchema }).strict(),
		body: catalogTransitionTransportSchema,
	},
	async () => commandTransportRequired(),
);

export const publishCatalogRevision = createAdminEndpoint(
	"/admin/catalog/revisions/:id/publish",
	{
		method: "POST",
		params: z.object({ id: resourceIdentifierSchema }).strict(),
		body: catalogTransitionTransportSchema,
	},
	async () => commandTransportRequired(),
);

export const getCatalogRevision = createAdminEndpoint(
	"/admin/catalog/revisions/:id",
	{
		method: "GET",
		params: z.object({ id: resourceIdentifierSchema }).strict(),
	},
	async (ctx) => {
		const stored = await ctx.context.data.get("catalogRevision", ctx.params.id);
		if (!stored) {
			return {
				code: "CATALOG_REVISION_NOT_FOUND",
				error: "The Catalog revision was not found.",
				status: 404,
			};
		}
		const revision = catalogRevisionRecordSchema.safeParse(stored);
		if (!revision.success) {
			return {
				code: "INVALID_CATALOG_REVISION",
				error: "The stored Catalog revision is malformed.",
				status: 500,
			};
		}
		return { revision: revision.data };
	},
);

export const listCatalogRevisions = createAdminEndpoint(
	"/admin/catalog/revisions/list",
	{
		method: "GET",
		query: z
			.object({
				state: catalogRevisionStateSchema.optional(),
				limit: z.coerce.number().int().min(1).max(100).default(25),
				offset: z.coerce.number().int().min(0).default(0),
			})
			.strict(),
	},
	async (ctx) => {
		const stored = await ctx.context.data.findMany("catalogRevision", {
			...(ctx.query.state === undefined
				? {}
				: { where: { state: ctx.query.state } }),
			orderBy: { createdAt: "desc" },
			take: ctx.query.limit,
			skip: ctx.query.offset,
		});
		const revisions: CatalogRevisionRecord[] = [];
		for (const row of stored) {
			const revision = catalogRevisionRecordSchema.safeParse(row);
			if (!revision.success) {
				return {
					code: "INVALID_CATALOG_REVISION",
					error: "A stored Catalog revision is malformed.",
					status: 500,
				};
			}
			revisions.push(revision.data);
		}
		return {
			revisions: revisions.map(revisionSummary),
			pagination: {
				limit: ctx.query.limit,
				offset: ctx.query.offset,
				nextOffset:
					revisions.length < ctx.query.limit
						? null
						: ctx.query.offset + revisions.length,
			},
		};
	},
);
