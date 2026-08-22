import { createHash } from "node:crypto";
import {
	catalogDraftCommandInputSchema,
	catalogRevisionOperationDecisionSchema,
	catalogTransitionTransportSchema,
} from "@86d-app/products/catalog-revisions";
import type { CommandPrincipal } from "@86d-app/runtime/command";
import type { Session } from "auth";
import env from "env";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
	catalogDraftCommandReference,
	catalogPublishCommandReference,
	catalogReviewCommandReference,
	createCatalogCommandExecutor,
	createStoreAdminCatalogAuthority,
} from "./catalog-command-executor";

export type CatalogRevisionCommandKind =
	| { action: "draft" }
	| { action: "review"; revisionId: string }
	| { action: "publish"; revisionId: string };

export function matchCatalogRevisionCommandPath(
	path: string,
): CatalogRevisionCommandKind | null {
	if (path === "/admin/catalog/revisions/create") {
		return { action: "draft" };
	}
	const review = /^\/admin\/catalog\/revisions\/([^/]+)\/review$/.exec(path);
	if (review?.[1]) {
		return { action: "review", revisionId: review[1] };
	}
	const publish = /^\/admin\/catalog\/revisions\/([^/]+)\/publish$/.exec(path);
	if (publish?.[1]) {
		return { action: "publish", revisionId: publish[1] };
	}
	return null;
}

function commandFailureStatus(code: string) {
	switch (code) {
		case "invalid_request":
		case "invalid_input":
			return 400;
		case "unauthenticated":
			return 401;
		case "forbidden":
			return 403;
		case "target_not_found":
			return 404;
		case "idempotency_conflict":
			return 409;
		case "temporarily_unavailable":
			return 503;
		default:
			return 422;
	}
}

function failureResponse(code: string, message: string, status: number) {
	return NextResponse.json({ error: { code, message } }, { status });
}

/** Authenticated edge adapter for Catalog revision Commands. */
export async function handleCatalogRevisionCommand(
	request: NextRequest,
	session: Session,
	kind: CatalogRevisionCommandKind,
) {
	const body = await request.json().catch(() => undefined);
	const parsed =
		kind.action === "draft"
			? catalogDraftCommandInputSchema.safeParse(body)
			: catalogTransitionTransportSchema.safeParse(body);
	if (!parsed.success) {
		return failureResponse(
			"INVALID_CATALOG_REVISION",
			"The Catalog revision request is invalid.",
			400,
		);
	}

	if (!env.BETTER_AUTH_SECRET) {
		return failureResponse(
			"COMMAND_DIGEST_KEY_UNAVAILABLE",
			"Store Commands are unavailable until the Store authentication secret is configured.",
			503,
		);
	}

	const digestKey = createHash("sha256")
		.update("86d.store-command.digest.v1\0")
		.update(env.BETTER_AUTH_SECRET)
		.digest("hex");
	const principal = {
		type: "session",
		credentialId: session.session.id,
		sessionId: session.session.id,
	} satisfies CommandPrincipal;
	const executor = await createCatalogCommandExecutor({
		authority: createStoreAdminCatalogAuthority({
			storeId: env.STORE_ID,
			userId: session.user.id,
			sessionId: session.session.id,
			role: session.user.role,
		}),
		digestKey,
	});
	const input =
		kind.action === "draft"
			? parsed.data
			: {
					...parsed.data,
					revisionId: kind.revisionId,
				};
	const command =
		kind.action === "draft"
			? catalogDraftCommandReference
			: kind.action === "review"
				? catalogReviewCommandReference
				: catalogPublishCommandReference;
	const result = await executor.execute(
		{
			command,
			idempotencyKey: parsed.data.operationId,
			target: { type: "store", id: env.STORE_ID },
			input,
		},
		{ principal },
	);

	if (!result.ok) {
		return failureResponse(
			result.failure.code.toUpperCase(),
			result.failure.message,
			commandFailureStatus(result.failure.code),
		);
	}
	if (result.receipt.status !== "succeeded") {
		return failureResponse(
			"COMMAND_IN_PROGRESS",
			"The Catalog Command has not reached a terminal result.",
			503,
		);
	}

	const revision = catalogRevisionOperationDecisionSchema.safeParse(
		result.receipt.result,
	);
	if (!revision.success) {
		return failureResponse(
			"INVALID_COMMAND_RESULT",
			"The Catalog Command returned an invalid result.",
			500,
		);
	}

	return NextResponse.json(
		{
			revision: revision.data,
			executionId: result.receipt.executionId,
			replayed: result.receipt.replayed,
		},
		{
			status: kind.action === "draft" && !result.receipt.replayed ? 201 : 200,
		},
	);
}
