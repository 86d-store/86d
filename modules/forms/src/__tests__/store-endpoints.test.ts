import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFormsControllers } from "../service-impl";

/**
 * Store endpoint integration tests for the forms module.
 *
 * Store endpoints:
 *   GET  /forms            — list active forms
 *   GET  /forms/:slug      — get active form by slug
 *   POST /forms/:slug/submit — submit form values
 *
 * Tests verify:
 * 1. list-forms: returns only active forms
 * 2. get-form: by slug, returns null for inactive, null for missing
 * 3. submit-form: valid submission, validates required fields, validates email, validates select options
 * 4. honeypot: silently succeeds when honeypot filled (no submission created)
 * 5. max-submissions: rejects when limit reached
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListForms(data: DataService) {
	const controller = createFormsControllers(data);
	const forms = await controller.listForms({ activeOnly: true });
	return { forms };
}

async function simulateGetForm(data: DataService, slug: string) {
	const controller = createFormsControllers(data);
	const form = await controller.getFormBySlug(slug);
	if (!form?.isActive) {
		return { form: null };
	}
	return { form };
}

async function simulateSubmitForm(
	data: DataService,
	slug: string,
	body: { values: Record<string, unknown>; _hp?: string },
) {
	const controller = createFormsControllers(data);
	const form = await controller.getFormBySlug(slug);

	if (!form?.isActive) {
		return { error: "Form not found", status: 404 };
	}

	// Honeypot check: if _hp is filled, silently accept but don't store
	if (form.honeypotEnabled && body._hp) {
		return {
			success: true,
			message: form.successMessage,
		};
	}

	const submission = await controller.submitForm({
		formId: form.id,
		values: body.values,
	});

	return {
		success: true,
		message: form.successMessage,
		submissionId: submission.id,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list forms — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active forms", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({ name: "Contact Us", slug: "contact-us" });
		const inactive = await ctrl.createForm({
			name: "Old Survey",
			slug: "old-survey",
		});
		await ctrl.updateForm(inactive.id, { isActive: false });

		const result = await simulateListForms(data);

		expect(result.forms).toHaveLength(1);
		expect(result.forms[0]?.name).toBe("Contact Us");
	});

	it("returns empty array when no active forms exist", async () => {
		const ctrl = createFormsControllers(data);
		const form = await ctrl.createForm({
			name: "Disabled",
			slug: "disabled",
		});
		await ctrl.updateForm(form.id, { isActive: false });

		const result = await simulateListForms(data);

		expect(result.forms).toHaveLength(0);
	});

	it("returns multiple active forms", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({ name: "Contact", slug: "contact" });
		await ctrl.createForm({ name: "Feedback", slug: "feedback" });
		await ctrl.createForm({ name: "Survey", slug: "survey" });

		const result = await simulateListForms(data);

		expect(result.forms).toHaveLength(3);
	});
});

describe("store endpoint: get form — slug lookup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active form by slug", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "Contact Us",
			slug: "contact-us",
			fields: [
				{
					name: "email",
					label: "Email",
					type: "email",
					required: true,
					position: 0,
				},
			],
		});

		const result = await simulateGetForm(data, "contact-us");

		expect(result.form).not.toBeNull();
		expect(result.form?.name).toBe("Contact Us");
		expect(result.form?.fields).toHaveLength(1);
	});

	it("returns null for inactive form", async () => {
		const ctrl = createFormsControllers(data);
		const form = await ctrl.createForm({
			name: "Archived",
			slug: "archived",
		});
		await ctrl.updateForm(form.id, { isActive: false });

		const result = await simulateGetForm(data, "archived");

		expect(result.form).toBeNull();
	});

	it("returns null for nonexistent slug", async () => {
		const result = await simulateGetForm(data, "does-not-exist");

		expect(result.form).toBeNull();
	});
});

describe("store endpoint: submit form — validation", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("accepts a valid submission", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "Contact",
			slug: "contact",
			fields: [
				{
					name: "name",
					label: "Name",
					type: "text",
					required: true,
					position: 0,
				},
				{
					name: "email",
					label: "Email",
					type: "email",
					required: true,
					position: 1,
				},
			],
		});

		const result = await simulateSubmitForm(data, "contact", {
			values: { name: "Jane Doe", email: "jane@example.com" },
		});

		expect(result.success).toBe(true);
		expect(result.submissionId).toBeDefined();
	});

	it("rejects when required fields are missing", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "Contact",
			slug: "contact",
			fields: [
				{
					name: "name",
					label: "Name",
					type: "text",
					required: true,
					position: 0,
				},
				{
					name: "email",
					label: "Email",
					type: "email",
					required: true,
					position: 1,
				},
			],
		});

		await expect(
			simulateSubmitForm(data, "contact", {
				values: { name: "Jane" },
			}),
		).rejects.toThrow("Validation failed");
	});

	it("rejects invalid email format", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "Contact",
			slug: "contact",
			fields: [
				{
					name: "email",
					label: "Email",
					type: "email",
					required: true,
					position: 0,
				},
			],
		});

		await expect(
			simulateSubmitForm(data, "contact", {
				values: { email: "not-an-email" },
			}),
		).rejects.toThrow("must be a valid email address");
	});

	it("rejects invalid select option", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "Survey",
			slug: "survey",
			fields: [
				{
					name: "color",
					label: "Favorite Color",
					type: "select",
					required: true,
					options: ["red", "blue", "green"],
					position: 0,
				},
			],
		});

		await expect(
			simulateSubmitForm(data, "survey", {
				values: { color: "purple" },
			}),
		).rejects.toThrow("must be one of");
	});

	it("accepts valid select option", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "Survey",
			slug: "survey",
			fields: [
				{
					name: "color",
					label: "Favorite Color",
					type: "select",
					required: true,
					options: ["red", "blue", "green"],
					position: 0,
				},
			],
		});

		const result = await simulateSubmitForm(data, "survey", {
			values: { color: "blue" },
		});

		expect(result.success).toBe(true);
	});

	it("returns 404 for nonexistent form slug", async () => {
		const result = await simulateSubmitForm(data, "ghost", {
			values: { name: "Test" },
		});

		expect(result).toEqual({ error: "Form not found", status: 404 });
	});

	it("returns 404 for inactive form", async () => {
		const ctrl = createFormsControllers(data);
		const form = await ctrl.createForm({
			name: "Closed",
			slug: "closed",
		});
		await ctrl.updateForm(form.id, { isActive: false });

		const result = await simulateSubmitForm(data, "closed", {
			values: {},
		});

		expect(result).toEqual({ error: "Form not found", status: 404 });
	});
});

describe("store endpoint: honeypot protection", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("silently succeeds when honeypot is filled (no submission created)", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "Contact",
			slug: "contact",
			honeypotEnabled: true,
			fields: [
				{
					name: "email",
					label: "Email",
					type: "email",
					required: true,
					position: 0,
				},
			],
		});

		const result = await simulateSubmitForm(data, "contact", {
			values: { email: "bot@spam.com" },
			_hp: "i-am-a-bot",
		});

		expect(result.success).toBe(true);
		expect(result.message).toBeDefined();
		// No submissionId — the submission was silently discarded
		expect(result.submissionId).toBeUndefined();

		// Verify nothing was stored
		const submissions = await ctrl.listSubmissions({ formId: undefined });
		expect(submissions).toHaveLength(0);
	});

	it("creates submission normally when honeypot is empty", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "Contact",
			slug: "contact",
			honeypotEnabled: true,
			fields: [
				{
					name: "email",
					label: "Email",
					type: "email",
					required: true,
					position: 0,
				},
			],
		});

		const result = await simulateSubmitForm(data, "contact", {
			values: { email: "real@user.com" },
		});

		expect(result.success).toBe(true);
		expect(result.submissionId).toBeDefined();
	});

	it("stores submission when honeypot is disabled even with _hp filled", async () => {
		const ctrl = createFormsControllers(data);
		await ctrl.createForm({
			name: "No Honeypot",
			slug: "no-honeypot",
			honeypotEnabled: false,
			fields: [
				{
					name: "name",
					label: "Name",
					type: "text",
					required: false,
					position: 0,
				},
			],
		});

		const result = await simulateSubmitForm(data, "no-honeypot", {
			values: { name: "Test" },
			_hp: "filled-but-ignored",
		});

		expect(result.success).toBe(true);
		expect(result.submissionId).toBeDefined();
	});
});

describe("store endpoint: max submissions limit", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("rejects submission when limit is reached", async () => {
		const ctrl = createFormsControllers(data);
		const form = await ctrl.createForm({
			name: "Limited",
			slug: "limited",
			maxSubmissions: 2,
			fields: [
				{
					name: "name",
					label: "Name",
					type: "text",
					required: false,
					position: 0,
				},
			],
		});

		// Fill up the limit
		await ctrl.submitForm({ formId: form.id, values: { name: "First" } });
		await ctrl.submitForm({ formId: form.id, values: { name: "Second" } });

		// Third submission should be rejected
		await expect(
			simulateSubmitForm(data, "limited", {
				values: { name: "Third" },
			}),
		).rejects.toThrow("maximum number of submissions");
	});

	it("allows unlimited submissions when maxSubmissions is 0", async () => {
		const ctrl = createFormsControllers(data);
		const form = await ctrl.createForm({
			name: "Unlimited",
			slug: "unlimited",
			maxSubmissions: 0,
			fields: [
				{
					name: "name",
					label: "Name",
					type: "text",
					required: false,
					position: 0,
				},
			],
		});

		// Submit several times — all should succeed
		for (let i = 0; i < 5; i++) {
			await ctrl.submitForm({
				formId: form.id,
				values: { name: `Entry ${i}` },
			});
		}

		const result = await simulateSubmitForm(data, "unlimited", {
			values: { name: "One more" },
		});

		expect(result.success).toBe(true);
		expect(result.submissionId).toBeDefined();
	});

	it("allows submission when under the limit", async () => {
		const ctrl = createFormsControllers(data);
		const form = await ctrl.createForm({
			name: "Capped",
			slug: "capped",
			maxSubmissions: 3,
			fields: [
				{
					name: "name",
					label: "Name",
					type: "text",
					required: false,
					position: 0,
				},
			],
		});

		await ctrl.submitForm({ formId: form.id, values: { name: "First" } });

		const result = await simulateSubmitForm(data, "capped", {
			values: { name: "Second" },
		});

		expect(result.success).toBe(true);
		expect(result.submissionId).toBeDefined();
	});
});
