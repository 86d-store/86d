import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

const unavailable = {
	code: "RETURN_LIFECYCLE_WORKFLOW_REQUIRED",
	error:
		"Return lifecycle changes require a durable workflow with owning Payment, tax, Inventory, Shipping, loyalty, and communication operations.",
	status: 503,
};

const notesBody = z.object({
	adminNotes: z.string().max(2000).transform(sanitizeText).optional(),
});

export const approveReturnUnavailable = createAdminEndpoint(
	"/admin/returns/:id/approve",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: notesBody,
	},
	async () => unavailable,
);

export const rejectReturnUnavailable = createAdminEndpoint(
	"/admin/returns/:id/reject",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: notesBody,
	},
	async () => unavailable,
);

export const cancelReturnUnavailable = createAdminEndpoint(
	"/admin/returns/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async () => unavailable,
);

export const updateTrackingUnavailable = createAdminEndpoint(
	"/admin/returns/:id/tracking",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			trackingNumber: z.string().min(1).max(200).transform(sanitizeText),
			carrier: z.string().max(100).transform(sanitizeText).optional(),
		}),
	},
	async () => unavailable,
);
