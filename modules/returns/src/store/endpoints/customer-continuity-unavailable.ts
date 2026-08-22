import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";

const unavailable = {
	code: "RETURN_CUSTOMER_CONTINUITY_REQUIRED",
	error:
		"Return history requires verified Store Customer identity or a scoped guest proof.",
	status: 503,
};

export const listCustomerReturnsUnavailable = createStoreEndpoint(
	"/returns",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async () => unavailable,
);

export const getReturnStatusUnavailable = createStoreEndpoint(
	"/returns/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async () => unavailable,
);
