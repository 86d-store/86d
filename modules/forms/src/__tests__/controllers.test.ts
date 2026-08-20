import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { FormField } from "../service";
import { createFormsControllers } from "../service-impl";

describe("forms controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFormsControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFormsControllers(mockData);
	});

	function textField(
		overrides: Partial<FormField> & { name: string; label: string },
	): FormField {
		return {
			type: "text",
			required: false,
			position: 0,
			...overrides,
		};
	}

	async function createTestForm(
		overrides: Partial<Parameters<typeof controller.createForm>[0]> = {},
	) {
		return controller.createForm({
			name: "Test Form",
			slug: "test-form",
			...overrides,
		});
	}

	// ── Form CRUD defaults and edge cases ───────────────────────────

	describe("form creation defaults", () => {
		it("applies all default values when no optional params given", async () => {
			const form = await createTestForm();

			expect(form.fields).toEqual([]);
			expect(form.submitLabel).toBe("Submit");
			expect(form.successMessage).toBe("Thank you for your submission.");
			expect(form.isActive).toBe(true);
			expect(form.honeypotEnabled).toBe(true);
			expect(form.maxSubmissions).toBe(0);
			expect(form.notifyEmail).toBeUndefined();
			expect(form.description).toBeUndefined();
			expect(form.metadata).toEqual({});
		});

		it("preserves description and notifyEmail when explicitly set", async () => {
			const form = await createTestForm({
				description: "A form",
				notifyEmail: "admin@test.com",
			});

			expect(form.description).toBe("A form");
			expect(form.notifyEmail).toBe("admin@test.com");
		});
	});

	// ── updateForm — partial updates preserve other fields ─────────

	describe("updateForm — partial update preservation", () => {
		it("updating name preserves all other fields", async () => {
			const form = await createTestForm({
				description: "Original desc",
				submitLabel: "Go",
				successMessage: "Thanks!",
				honeypotEnabled: false,
				maxSubmissions: 10,
				notifyEmail: "notify@test.com",
				fields: [textField({ name: "f1", label: "Field 1", required: true })],
			});

			const updated = await controller.updateForm(form.id, {
				name: "New Name",
			});

			expect(updated.name).toBe("New Name");
			expect(updated.slug).toBe("test-form");
			expect(updated.description).toBe("Original desc");
			expect(updated.submitLabel).toBe("Go");
			expect(updated.successMessage).toBe("Thanks!");
			expect(updated.honeypotEnabled).toBe(false);
			expect(updated.maxSubmissions).toBe(10);
			expect(updated.notifyEmail).toBe("notify@test.com");
			expect(updated.fields).toHaveLength(1);
		});

		it("updating slug alone does not affect submissions lookup", async () => {
			const form = await createTestForm({ slug: "old-slug" });

			await controller.submitForm({ formId: form.id, values: {} });

			await controller.updateForm(form.id, { slug: "new-slug" });

			const subs = await controller.listSubmissions({ formId: form.id });
			expect(subs).toHaveLength(1);
		});

		it("throws when updating a non-existent form", async () => {
			await expect(
				controller.updateForm("does-not-exist", { name: "X" }),
			).rejects.toThrow("Form does-not-exist not found");
		});

		it("updatedAt advances on each update", async () => {
			const form = await createTestForm();

			const u1 = await controller.updateForm(form.id, { name: "A" });
			const u2 = await controller.updateForm(form.id, { name: "B" });

			expect(u2.updatedAt.getTime()).toBeGreaterThanOrEqual(
				u1.updatedAt.getTime(),
			);
		});
	});

	// ── getFormBySlug after slug update ──────────────────────────────

	describe("getFormBySlug — slug changes", () => {
		it("returns null for old slug after update", async () => {
			const form = await createTestForm({ slug: "original" });

			await controller.updateForm(form.id, { slug: "changed" });

			const byOld = await controller.getFormBySlug("original");
			const byNew = await controller.getFormBySlug("changed");

			expect(byOld).toBeNull();
			expect(byNew?.id).toBe(form.id);
		});
	});

	// ── listForms — activeOnly filter ────────────────────────────────

	describe("listForms — activeOnly interactions", () => {
		it("re-activating a form includes it in activeOnly list again", async () => {
			const form = await createTestForm();

			await controller.updateForm(form.id, { isActive: false });
			let active = await controller.listForms({ activeOnly: true });
			expect(active).toHaveLength(0);

			await controller.updateForm(form.id, { isActive: true });
			active = await controller.listForms({ activeOnly: true });
			expect(active).toHaveLength(1);
		});

		it("without activeOnly returns all forms regardless of status", async () => {
			await createTestForm({ slug: "a" });
			const inactive = await createTestForm({ slug: "b" });
			await controller.updateForm(inactive.id, { isActive: false });

			const all = await controller.listForms();
			expect(all).toHaveLength(2);
		});

		it("sorts forms by createdAt ascending", async () => {
			const first = await createTestForm({ slug: "first", name: "First" });
			const second = await createTestForm({ slug: "second", name: "Second" });
			const third = await createTestForm({ slug: "third", name: "Third" });

			// Ensure deterministic ordering by adjusting timestamps
			(first as { createdAt: Date }).createdAt = new Date(1000);
			(second as { createdAt: Date }).createdAt = new Date(2000);
			(third as { createdAt: Date }).createdAt = new Date(3000);
			await mockData.upsert(
				"form",
				first.id,
				first as unknown as Record<string, unknown>,
			);
			await mockData.upsert(
				"form",
				second.id,
				second as unknown as Record<string, unknown>,
			);
			await mockData.upsert(
				"form",
				third.id,
				third as unknown as Record<string, unknown>,
			);

			const forms = await controller.listForms();
			expect(forms[0].name).toBe("First");
			expect(forms[1].name).toBe("Second");
			expect(forms[2].name).toBe("Third");
		});
	});

	// ── deleteForm cascades to submissions ──────────────────────────

	describe("deleteForm — cascade behavior", () => {
		it("cascades deletion to all associated submissions", async () => {
			const form = await createTestForm();

			const s1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			const s2 = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			await controller.deleteForm(form.id);

			expect(await controller.getForm(form.id)).toBeNull();
			expect(await controller.getSubmission(s1.id)).toBeNull();
			expect(await controller.getSubmission(s2.id)).toBeNull();
		});

		it("does not affect submissions of other forms", async () => {
			const formA = await createTestForm({ slug: "form-a" });
			const formB = await createTestForm({ slug: "form-b" });

			await controller.submitForm({ formId: formA.id, values: {} });
			const subB = await controller.submitForm({
				formId: formB.id,
				values: {},
			});

			await controller.deleteForm(formA.id);

			const remainingSub = await controller.getSubmission(subB.id);
			expect(remainingSub).not.toBeNull();
			expect(remainingSub?.formId).toBe(formB.id);
		});

		it("handles deletion of form with zero submissions", async () => {
			const form = await createTestForm();

			await controller.deleteForm(form.id);

			expect(await controller.getForm(form.id)).toBeNull();
		});

		it("cascades deletion of form with many submissions", async () => {
			const form = await createTestForm();
			for (let i = 0; i < 15; i++) {
				await controller.submitForm({
					formId: form.id,
					values: { i },
				});
			}

			await controller.deleteForm(form.id);

			const subs = await controller.listSubmissions({ formId: form.id });
			expect(subs).toHaveLength(0);
		});
	});

	// ── Submission — inactive form and maxSubmissions ────────────────

	describe("submitForm — guard conditions", () => {
		it("rejects submission to inactive form", async () => {
			const form = await createTestForm();
			await controller.updateForm(form.id, { isActive: false });

			await expect(
				controller.submitForm({ formId: form.id, values: {} }),
			).rejects.toThrow("not currently accepting submissions");
		});

		it("rejects submission after maxSubmissions reached", async () => {
			const form = await createTestForm({ maxSubmissions: 1 });

			await controller.submitForm({ formId: form.id, values: {} });

			await expect(
				controller.submitForm({ formId: form.id, values: {} }),
			).rejects.toThrow("maximum number of submissions");
		});

		it("maxSubmissions=0 means unlimited", async () => {
			const form = await createTestForm({ maxSubmissions: 0 });

			for (let i = 0; i < 10; i++) {
				await controller.submitForm({
					formId: form.id,
					values: { i },
				});
			}

			const subs = await controller.listSubmissions({ formId: form.id });
			expect(subs).toHaveLength(10);
		});

		it("maxSubmissions boundary — exactly at limit succeeds, one more fails", async () => {
			const form = await createTestForm({ maxSubmissions: 3 });

			await controller.submitForm({ formId: form.id, values: {} });
			await controller.submitForm({ formId: form.id, values: {} });
			await controller.submitForm({ formId: form.id, values: {} });

			await expect(
				controller.submitForm({ formId: form.id, values: {} }),
			).rejects.toThrow("maximum number of submissions");
		});

		it("throws for non-existent form ID", async () => {
			await expect(
				controller.submitForm({ formId: "ghost", values: {} }),
			).rejects.toThrow("Form ghost not found");
		});
	});

	// ── Validation — all field types ─────────────────────────────────

	describe("submission validation — comprehensive", () => {
		it("validates email format rejects invalid addresses", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "email",
						label: "Email",
						type: "email",
						required: true,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { email: "missing-at-sign" },
				}),
			).rejects.toThrow("Email must be a valid email address");
		});

		it("accepts valid email address", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "email",
						label: "Email",
						type: "email",
						required: true,
					}),
				],
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: { email: "user@domain.co.uk" },
			});
			expect(sub.values.email).toBe("user@domain.co.uk");
		});

		it("validates URL must start with http:// or https://", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "site",
						label: "Website",
						type: "url",
						required: true,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { site: "ftp://files.example.com" },
				}),
			).rejects.toThrow("Website must be a valid URL");

			const sub = await controller.submitForm({
				formId: form.id,
				values: { site: "https://example.com/path" },
			});
			expect(sub.values.site).toBe("https://example.com/path");
		});

		it("validates number — rejects NaN", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "age",
						label: "Age",
						type: "number",
						required: true,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { age: "not-a-number" },
				}),
			).rejects.toThrow("Age must be a number");
		});

		it("validates number min constraint", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "qty",
						label: "Quantity",
						type: "number",
						required: true,
						min: 1,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { qty: 0 },
				}),
			).rejects.toThrow("Quantity must be at least 1");
		});

		it("validates number max constraint", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "qty",
						label: "Quantity",
						type: "number",
						required: true,
						max: 100,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { qty: 101 },
				}),
			).rejects.toThrow("Quantity must be at most 100");
		});

		it("validates text minLength", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "username",
						label: "Username",
						type: "text",
						required: true,
						min: 3,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { username: "ab" },
				}),
			).rejects.toThrow("Username must be at least 3 characters");
		});

		it("validates textarea maxLength", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "bio",
						label: "Bio",
						type: "textarea",
						required: true,
						max: 10,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { bio: "this is way too long" },
				}),
			).rejects.toThrow("Bio must be at most 10 characters");
		});

		it("validates pattern regex match", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "code",
						label: "Promo Code",
						type: "text",
						required: true,
						pattern: "^[A-Z]{3}-\\d{4}$",
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { code: "invalid" },
				}),
			).rejects.toThrow("Promo Code format is invalid");

			const sub = await controller.submitForm({
				formId: form.id,
				values: { code: "ABC-1234" },
			});
			expect(sub.values.code).toBe("ABC-1234");
		});

		it("validates select field requires value in options", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "color",
						label: "Color",
						type: "select",
						required: true,
						options: ["red", "blue", "green"],
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { color: "yellow" },
				}),
			).rejects.toThrow("Color must be one of: red, blue, green");

			const sub = await controller.submitForm({
				formId: form.id,
				values: { color: "blue" },
			});
			expect(sub.values.color).toBe("blue");
		});

		it("validates radio field requires value in options", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "size",
						label: "Size",
						type: "radio",
						required: true,
						options: ["S", "M", "L"],
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { size: "XL" },
				}),
			).rejects.toThrow("Size must be one of: S, M, L");
		});

		it("required field rejects undefined, null, and empty string", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "name",
						label: "Full Name",
						type: "text",
						required: true,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: {},
				}),
			).rejects.toThrow("Full Name is required");

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { name: "" },
				}),
			).rejects.toThrow("Full Name is required");

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { name: null },
				}),
			).rejects.toThrow("Full Name is required");
		});

		it("optional field skips validation when value is omitted", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "website",
						label: "Website",
						type: "url",
						required: false,
					}),
				],
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			expect(sub.id).toBeTruthy();
		});

		it("collects multiple validation errors into a single message", async () => {
			const form = await createTestForm({
				fields: [
					textField({
						name: "email",
						label: "Email",
						type: "email",
						required: true,
						position: 0,
					}),
					textField({
						name: "website",
						label: "Website",
						type: "url",
						required: true,
						position: 1,
					}),
					textField({
						name: "qty",
						label: "Qty",
						type: "number",
						required: true,
						position: 2,
					}),
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: {},
				}),
			).rejects.toThrow(
				"Email is required; Website is required; Qty is required",
			);
		});
	});

	// ── Submission status management ────────────────────────────────

	describe("updateSubmissionStatus — transitions", () => {
		it("transitions through all statuses: unread -> read -> archived", async () => {
			const form = await createTestForm();
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			expect(sub.status).toBe("unread");

			const read = await controller.updateSubmissionStatus(sub.id, "read");
			expect(read.status).toBe("read");

			const archived = await controller.updateSubmissionStatus(
				sub.id,
				"archived",
			);
			expect(archived.status).toBe("archived");
		});

		it("can mark as spam then revert to unread", async () => {
			const form = await createTestForm();
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			await controller.updateSubmissionStatus(sub.id, "spam");
			const reverted = await controller.updateSubmissionStatus(
				sub.id,
				"unread",
			);
			expect(reverted.status).toBe("unread");
		});

		it("throws for non-existent submission ID", async () => {
			await expect(
				controller.updateSubmissionStatus("ghost-id", "read"),
			).rejects.toThrow("Submission ghost-id not found");
		});
	});

	// ── bulkDeleteSubmissions — mixed existent/non-existent ─────────

	describe("bulkDeleteSubmissions — edge cases", () => {
		it("returns count of only actually deleted submissions", async () => {
			const form = await createTestForm();
			const s1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			const s2 = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			const deleted = await controller.bulkDeleteSubmissions([
				s1.id,
				"non-existent-1",
				s2.id,
				"non-existent-2",
			]);
			expect(deleted).toBe(2);
		});

		it("returns 0 when all IDs are non-existent", async () => {
			const deleted = await controller.bulkDeleteSubmissions([
				"ghost-a",
				"ghost-b",
				"ghost-c",
			]);
			expect(deleted).toBe(0);
		});

		it("handles empty array", async () => {
			const deleted = await controller.bulkDeleteSubmissions([]);
			expect(deleted).toBe(0);
		});

		it("actually removes submissions from storage", async () => {
			const form = await createTestForm();
			const s1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			const s2 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			const s3 = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			await controller.bulkDeleteSubmissions([s1.id, s3.id]);

			expect(await controller.getSubmission(s1.id)).toBeNull();
			expect(await controller.getSubmission(s2.id)).not.toBeNull();
			expect(await controller.getSubmission(s3.id)).toBeNull();
		});
	});

	// ── Stats aggregation ───────────────────────────────────────────

	describe("getStats — aggregation scenarios", () => {
		it("returns zeros when no forms or submissions exist", async () => {
			const stats = await controller.getStats();

			expect(stats.totalForms).toBe(0);
			expect(stats.totalSubmissions).toBe(0);
			expect(stats.unreadCount).toBe(0);
			expect(stats.spamCount).toBe(0);
		});

		it("counts forms and submissions across multiple forms", async () => {
			const f1 = await createTestForm({ slug: "form-1" });
			const f2 = await createTestForm({ slug: "form-2" });

			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f2.id, values: {} });

			const stats = await controller.getStats();
			expect(stats.totalForms).toBe(2);
			expect(stats.totalSubmissions).toBe(3);
			expect(stats.unreadCount).toBe(3);
			expect(stats.spamCount).toBe(0);
		});

		it("filters stats by formId", async () => {
			const f1 = await createTestForm({ slug: "form-1" });
			const f2 = await createTestForm({ slug: "form-2" });

			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f2.id, values: {} });

			const stats = await controller.getStats(f1.id);
			expect(stats.totalForms).toBe(1);
			expect(stats.totalSubmissions).toBe(2);
		});

		it("tracks unread and spam counts separately", async () => {
			const form = await createTestForm();

			const s1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			const s2 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			const s3 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			await controller.submitForm({ formId: form.id, values: {} });

			await controller.updateSubmissionStatus(s1.id, "read");
			await controller.updateSubmissionStatus(s2.id, "spam");
			await controller.updateSubmissionStatus(s3.id, "spam");

			const stats = await controller.getStats();
			expect(stats.totalSubmissions).toBe(4);
			expect(stats.unreadCount).toBe(1);
			expect(stats.spamCount).toBe(2);
		});

		it("stats update after deletions", async () => {
			const form = await createTestForm();
			const s1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			await controller.submitForm({ formId: form.id, values: {} });

			await controller.deleteSubmission(s1.id);

			const stats = await controller.getStats();
			expect(stats.totalSubmissions).toBe(1);
			expect(stats.unreadCount).toBe(1);
		});

		it("stats reflect form deletion with cascade", async () => {
			const f1 = await createTestForm({ slug: "f1" });
			const f2 = await createTestForm({ slug: "f2" });

			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f2.id, values: {} });

			await controller.deleteForm(f1.id);

			const stats = await controller.getStats();
			expect(stats.totalForms).toBe(1);
			expect(stats.totalSubmissions).toBe(1);
		});
	});

	// ── listSubmissions — filtering and pagination ───────────────────

	describe("listSubmissions — advanced filtering", () => {
		it("filters by formId isolates results", async () => {
			const f1 = await createTestForm({ slug: "f1" });
			const f2 = await createTestForm({ slug: "f2" });

			await controller.submitForm({ formId: f1.id, values: { from: "f1" } });
			await controller.submitForm({ formId: f1.id, values: { from: "f1" } });
			await controller.submitForm({ formId: f2.id, values: { from: "f2" } });

			const f1Subs = await controller.listSubmissions({ formId: f1.id });
			const f2Subs = await controller.listSubmissions({ formId: f2.id });

			expect(f1Subs).toHaveLength(2);
			expect(f2Subs).toHaveLength(1);
		});

		it("filters by status across forms", async () => {
			const f1 = await createTestForm({ slug: "f1" });
			const f2 = await createTestForm({ slug: "f2" });

			const s1 = await controller.submitForm({
				formId: f1.id,
				values: {},
			});
			await controller.submitForm({ formId: f2.id, values: {} });

			await controller.updateSubmissionStatus(s1.id, "spam");

			const spam = await controller.listSubmissions({ status: "spam" });
			expect(spam).toHaveLength(1);
			expect(spam[0].formId).toBe(f1.id);
		});

		it("default limit is 50", async () => {
			const form = await createTestForm();
			for (let i = 0; i < 55; i++) {
				await controller.submitForm({
					formId: form.id,
					values: { i },
				});
			}

			const subs = await controller.listSubmissions({ formId: form.id });
			expect(subs).toHaveLength(50);
		});

		it("offset skips first N results", async () => {
			const form = await createTestForm();
			for (let i = 0; i < 5; i++) {
				await controller.submitForm({
					formId: form.id,
					values: { i },
				});
			}

			const page = await controller.listSubmissions({
				formId: form.id,
				limit: 10,
				offset: 3,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── Cross-method interactions ───────────────────────────────────

	describe("cross-method interactions", () => {
		it("submission inherits default status of unread", async () => {
			const form = await createTestForm();
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			expect(sub.status).toBe("unread");

			const fetched = await controller.getSubmission(sub.id);
			expect(fetched?.status).toBe("unread");
		});

		it("submission records ipAddress when provided", async () => {
			const form = await createTestForm();
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
				ipAddress: "10.0.0.1",
			});

			expect(sub.ipAddress).toBe("10.0.0.1");
		});

		it("submission ipAddress is undefined when not provided", async () => {
			const form = await createTestForm();
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			expect(sub.ipAddress).toBeUndefined();
		});

		it("deleteSubmission removes single without affecting others", async () => {
			const form = await createTestForm();
			const s1 = await controller.submitForm({
				formId: form.id,
				values: { n: 1 },
			});
			const s2 = await controller.submitForm({
				formId: form.id,
				values: { n: 2 },
			});

			await controller.deleteSubmission(s1.id);

			expect(await controller.getSubmission(s1.id)).toBeNull();
			expect(await controller.getSubmission(s2.id)).not.toBeNull();

			const subs = await controller.listSubmissions({ formId: form.id });
			expect(subs).toHaveLength(1);
		});

		it("updating form fields affects subsequent submission validation", async () => {
			const form = await createTestForm({ fields: [] });

			// No fields — any values pass
			const s1 = await controller.submitForm({
				formId: form.id,
				values: { anything: "goes" },
			});
			expect(s1.id).toBeTruthy();

			// Now add a required field
			await controller.updateForm(form.id, {
				fields: [
					textField({
						name: "required_field",
						label: "Required",
						type: "text",
						required: true,
					}),
				],
			});

			// Subsequent submissions must satisfy the new required field
			await expect(
				controller.submitForm({
					formId: form.id,
					values: {},
				}),
			).rejects.toThrow("Required is required");
		});
	});
});
