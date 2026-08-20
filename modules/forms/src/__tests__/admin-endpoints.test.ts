import { describe, expect, it, vi } from "vitest";
import { bulkDeleteSubmissions } from "../admin/endpoints/bulk-delete-submissions";
import { createForm } from "../admin/endpoints/create-form";
import { deleteForm } from "../admin/endpoints/delete-form";
import { deleteSubmission } from "../admin/endpoints/delete-submission";
import { getForm } from "../admin/endpoints/get-form";
import { getSubmission } from "../admin/endpoints/get-submission";
import { listForms } from "../admin/endpoints/list-forms";
import { listSubmissions } from "../admin/endpoints/list-submissions";
import { getStats } from "../admin/endpoints/stats";
import { updateForm } from "../admin/endpoints/update-form";
import { updateSubmissionStatus } from "../admin/endpoints/update-submission-status";
import type {
	Form,
	FormField,
	FormSubmission,
	FormsController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeField(overrides: Partial<FormField> = {}): FormField {
	return {
		name: "email",
		label: "Email",
		type: "email",
		required: true,
		position: 0,
		...overrides,
	};
}

function makeForm(overrides: Partial<Form> = {}): Form {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Contact Form",
		slug: "contact",
		fields: [makeField()],
		submitLabel: "Submit",
		successMessage: "Thank you!",
		isActive: true,
		honeypotEnabled: false,
		maxSubmissions: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeSubmission(
	overrides: Partial<FormSubmission> = {},
): FormSubmission {
	return {
		id: crypto.randomUUID(),
		formId: "form_1",
		values: { email: "alice@example.com" },
		status: "unread",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<FormsController> = {},
): FormsController {
	return {
		createForm: vi.fn().mockResolvedValue(makeForm()),
		getForm: vi.fn().mockResolvedValue(null),
		getFormBySlug: vi.fn().mockResolvedValue(null),
		listForms: vi.fn().mockResolvedValue([]),
		updateForm: vi.fn().mockResolvedValue(makeForm()),
		deleteForm: vi.fn().mockResolvedValue(undefined),
		submitForm: vi.fn().mockResolvedValue(makeSubmission()),
		getSubmission: vi.fn().mockResolvedValue(null),
		listSubmissions: vi.fn().mockResolvedValue([]),
		updateSubmissionStatus: vi.fn().mockResolvedValue(makeSubmission()),
		deleteSubmission: vi.fn().mockResolvedValue(undefined),
		bulkDeleteSubmissions: vi.fn().mockResolvedValue(0),
		getStats: vi.fn().mockResolvedValue({
			totalForms: 0,
			totalSubmissions: 0,
			unreadCount: 0,
			spamCount: 0,
		}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: FormsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { forms: opts.controller ?? makeController() } },
	});
}

const listHandler = extractHandler(listForms);
const createHandler = extractHandler(createForm);
const statsHandler = extractHandler(getStats);
const getHandler = extractHandler(getForm);
const updateHandler = extractHandler(updateForm);
const deleteFormHandler = extractHandler(deleteForm);
const listSubmissionsHandler = extractHandler(listSubmissions);
const getSubmissionHandler = extractHandler(getSubmission);
const updateStatusHandler = extractHandler(updateSubmissionStatus);
const deleteSubmissionHandler = extractHandler(deleteSubmission);
const bulkDeleteHandler = extractHandler(bulkDeleteSubmissions);

describe("admin GET /forms", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as { forms: Form[] };
		expect(result.forms).toHaveLength(0);
	});

	it("returns list of forms", async () => {
		const form = makeForm({ id: "form_1" });
		const ctrl = makeController({
			listForms: vi.fn().mockResolvedValue([form]),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			forms: Form[];
		};
		expect(result.forms).toHaveLength(1);
		expect(result.forms[0].id).toBe("form_1");
	});
});

describe("admin POST /forms/create", () => {
	it("creates a form and returns it", async () => {
		const form = makeForm({ name: "Newsletter", slug: "newsletter" });
		const ctrl = makeController({
			createForm: vi.fn().mockResolvedValue(form),
		});
		const result = (await call(createHandler, {
			body: { name: "Newsletter", slug: "newsletter" },
			controller: ctrl,
		})) as { form: Form };
		expect(result.form.name).toBe("Newsletter");
		expect(result.form.slug).toBe("newsletter");
	});
});

describe("admin GET /forms/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as {
			stats: {
				totalForms: number;
				totalSubmissions: number;
				unreadCount: number;
				spamCount: number;
			};
		};
		expect(result.stats.totalForms).toBe(0);
		expect(result.stats.totalSubmissions).toBe(0);
		expect(result.stats.unreadCount).toBe(0);
		expect(result.stats.spamCount).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalForms: 5,
				totalSubmissions: 120,
				unreadCount: 8,
				spamCount: 3,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: {
				totalForms: number;
				totalSubmissions: number;
				unreadCount: number;
				spamCount: number;
			};
		};
		expect(result.stats.totalForms).toBe(5);
		expect(result.stats.totalSubmissions).toBe(120);
		expect(result.stats.unreadCount).toBe(8);
	});

	it("forwards formId query param", async () => {
		const ctrl = makeController();
		await call(statsHandler, {
			query: { formId: "form_1" },
			controller: ctrl,
		});
		expect(ctrl.getStats).toHaveBeenCalledWith("form_1");
	});
});

describe("admin GET /forms/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Form not found");
	});

	it("returns form when found", async () => {
		const form = makeForm({ id: "form_1" });
		const ctrl = makeController({
			getForm: vi.fn().mockResolvedValue(form),
		});
		const result = (await call(getHandler, {
			params: { id: "form_1" },
			controller: ctrl,
		})) as { form: Form };
		expect(result.form.id).toBe("form_1");
	});
});

describe("admin POST /forms/:id/update", () => {
	it("updates a form and returns it", async () => {
		const form = makeForm({ name: "Updated Form" });
		const ctrl = makeController({
			updateForm: vi.fn().mockResolvedValue(form),
		});
		const result = (await call(updateHandler, {
			params: { id: form.id },
			body: { name: "Updated Form" },
			controller: ctrl,
		})) as { form: Form };
		expect(result.form.name).toBe("Updated Form");
	});

	it("calls updateForm with the correct id and body", async () => {
		const ctrl = makeController();
		await call(updateHandler, {
			params: { id: "form_1" },
			body: { isActive: false },
			controller: ctrl,
		});
		expect(ctrl.updateForm).toHaveBeenCalledWith(
			"form_1",
			expect.objectContaining({ isActive: false }),
		);
	});
});

describe("admin POST /forms/:id/delete", () => {
	it("deletes form and returns success", async () => {
		const ctrl = makeController({
			deleteForm: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteFormHandler, {
			params: { id: "form_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteForm).toHaveBeenCalledWith("form_1");
	});
});

describe("admin GET /forms/:formId/submissions", () => {
	it("returns empty list", async () => {
		const result = (await call(listSubmissionsHandler, {
			params: { formId: "form_1" },
		})) as { submissions: FormSubmission[] };
		expect(result.submissions).toHaveLength(0);
	});

	it("returns submissions for a form", async () => {
		const sub = makeSubmission({ formId: "form_1" });
		const ctrl = makeController({
			listSubmissions: vi.fn().mockResolvedValue([sub]),
		});
		const result = (await call(listSubmissionsHandler, {
			params: { formId: "form_1" },
			controller: ctrl,
		})) as { submissions: FormSubmission[] };
		expect(result.submissions).toHaveLength(1);
		expect(result.submissions[0].formId).toBe("form_1");
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listSubmissionsHandler, {
			params: { formId: "form_1" },
			query: { status: "spam" },
			controller: ctrl,
		});
		expect(ctrl.listSubmissions).toHaveBeenCalledWith(
			expect.objectContaining({ status: "spam", formId: "form_1" }),
		);
	});
});

describe("admin GET /forms/submissions/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getSubmissionHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Submission not found");
	});

	it("returns submission when found (already read)", async () => {
		const sub = makeSubmission({ id: "sub_1", status: "read" });
		const ctrl = makeController({
			getSubmission: vi.fn().mockResolvedValue(sub),
		});
		const result = (await call(getSubmissionHandler, {
			params: { id: "sub_1" },
			controller: ctrl,
		})) as { submission: FormSubmission };
		expect(result.submission.id).toBe("sub_1");
	});

	it("auto-marks unread submission as read", async () => {
		const unreadSub = makeSubmission({ id: "sub_1", status: "unread" });
		const readSub = makeSubmission({ id: "sub_1", status: "read" });
		const ctrl = makeController({
			getSubmission: vi.fn().mockResolvedValue(unreadSub),
			updateSubmissionStatus: vi.fn().mockResolvedValue(readSub),
		});
		const result = (await call(getSubmissionHandler, {
			params: { id: "sub_1" },
			controller: ctrl,
		})) as { submission: FormSubmission };
		expect(ctrl.updateSubmissionStatus).toHaveBeenCalledWith("sub_1", "read");
		expect(result.submission.status).toBe("read");
	});
});

describe("admin POST /forms/submissions/:id/status", () => {
	it("updates submission status", async () => {
		const sub = makeSubmission({ id: "sub_1", status: "spam" });
		const ctrl = makeController({
			updateSubmissionStatus: vi.fn().mockResolvedValue(sub),
		});
		const result = (await call(updateStatusHandler, {
			params: { id: "sub_1" },
			body: { status: "spam" },
			controller: ctrl,
		})) as { submission: FormSubmission };
		expect(result.submission.status).toBe("spam");
		expect(ctrl.updateSubmissionStatus).toHaveBeenCalledWith("sub_1", "spam");
	});

	it("updates status to archived", async () => {
		const sub = makeSubmission({ id: "sub_2", status: "archived" });
		const ctrl = makeController({
			updateSubmissionStatus: vi.fn().mockResolvedValue(sub),
		});
		const result = (await call(updateStatusHandler, {
			params: { id: "sub_2" },
			body: { status: "archived" },
			controller: ctrl,
		})) as { submission: FormSubmission };
		expect(result.submission.status).toBe("archived");
	});
});

describe("admin POST /forms/submissions/:id/delete", () => {
	it("deletes submission and returns success", async () => {
		const ctrl = makeController({
			deleteSubmission: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteSubmissionHandler, {
			params: { id: "sub_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteSubmission).toHaveBeenCalledWith("sub_1");
	});
});

describe("admin POST /forms/submissions/bulk-delete", () => {
	it("bulk deletes and returns count", async () => {
		const ctrl = makeController({
			bulkDeleteSubmissions: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["sub_1", "sub_2", "sub_3"] },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(3);
		expect(ctrl.bulkDeleteSubmissions).toHaveBeenCalledWith([
			"sub_1",
			"sub_2",
			"sub_3",
		]);
	});

	it("returns 0 when nothing to delete", async () => {
		const ctrl = makeController({
			bulkDeleteSubmissions: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["nonexistent"] },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(0);
	});
});
