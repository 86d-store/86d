import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createOrderNotesController } from "../service-impl";

/**
 * Store endpoint integration tests for the order-notes module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. add-note: customer adds a note to their order
 * 2. list-by-order: returns non-internal notes for an order
 * 3. get-note: returns a single note
 * 4. update-note: customer edits their own note; 401 without auth; 404 if not owner
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateAddNote(
	data: DataService,
	body: { orderId: string; content: string },
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createOrderNotesController(data);
	const note = await controller.addNote({
		orderId: body.orderId,
		content: body.content,
		authorId: opts.customerId,
		authorName: "Customer",
		authorType: "customer",
		isInternal: false,
	});
	return { note };
}

async function simulateListByOrder(
	data: DataService,
	orderId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createOrderNotesController(data);
	const notes = await controller.listByOrder(orderId, {
		includeInternal: false,
	});
	return { notes };
}

async function simulateGetNote(
	data: DataService,
	noteId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createOrderNotesController(data);
	const note = await controller.getNote(noteId);
	if (!note || note.isInternal) {
		return { error: "Note not found", status: 404 };
	}
	return { note };
}

async function simulateUpdateNote(
	data: DataService,
	noteId: string,
	content: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createOrderNotesController(data);
	const note = await controller.updateNote(
		noteId,
		opts.customerId,
		content,
		false,
	);
	if (!note) {
		return { error: "Note not found", status: 404 };
	}
	return { note };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: add note — customer note on order", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateAddNote(data, {
			orderId: "order_1",
			content: "Please deliver after 5pm",
		});
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("adds a customer note to an order", async () => {
		const result = await simulateAddNote(
			data,
			{
				orderId: "order_1",
				content: "Leave at the front door",
			},
			{ customerId: "cust_1" },
		);

		expect("note" in result).toBe(true);
		if (!("note" in result)) {
			throw new Error("expected 'note' in result");
		}
		expect(result.note.content).toBe("Leave at the front door");
		expect(result.note.orderId).toBe("order_1");
		expect(result.note.isInternal).toBe(false);
	});
});

describe("store endpoint: list by order — non-internal notes", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateListByOrder(data, "order_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns only non-internal notes", async () => {
		const ctrl = createOrderNotesController(data);
		await ctrl.addNote({
			orderId: "order_1",
			content: "Customer note",
			authorId: "cust_1",
			authorName: "Jane",
			authorType: "customer",
			isInternal: false,
		});
		await ctrl.addNote({
			orderId: "order_1",
			content: "Admin-only note",
			authorId: "admin_1",
			authorName: "Admin",
			authorType: "admin",
			isInternal: true,
		});

		const result = await simulateListByOrder(data, "order_1", {
			customerId: "cust_1",
		});

		expect("notes" in result).toBe(true);
		if (!("notes" in result)) {
			throw new Error("expected 'notes' in result");
		}
		expect(result.notes).toHaveLength(1);
		expect(result.notes[0].content).toBe("Customer note");
	});

	it("returns empty for order with no notes", async () => {
		const result = await simulateListByOrder(data, "order_empty", {
			customerId: "cust_1",
		});

		expect("notes" in result).toBe(true);
		if (!("notes" in result)) {
			throw new Error("expected 'notes' in result");
		}
		expect(result.notes).toHaveLength(0);
	});
});

describe("store endpoint: get note — single note", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetNote(data, "note_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns a non-internal note", async () => {
		const ctrl = createOrderNotesController(data);
		const note = await ctrl.addNote({
			orderId: "order_1",
			content: "Delivery instructions",
			authorId: "cust_1",
			authorName: "Jane",
			authorType: "customer",
			isInternal: false,
		});

		const result = await simulateGetNote(data, note.id, {
			customerId: "cust_1",
		});

		expect("note" in result).toBe(true);
		if (!("note" in result)) {
			throw new Error("expected 'note' in result");
		}
		expect(result.note.content).toBe("Delivery instructions");
	});

	it("returns 404 for internal note", async () => {
		const ctrl = createOrderNotesController(data);
		const note = await ctrl.addNote({
			orderId: "order_1",
			content: "Internal memo",
			authorId: "admin_1",
			authorName: "Admin",
			authorType: "admin",
			isInternal: true,
		});

		const result = await simulateGetNote(data, note.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Note not found", status: 404 });
	});

	it("returns 404 for nonexistent note", async () => {
		const result = await simulateGetNote(data, "ghost_note", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Note not found", status: 404 });
	});
});

describe("store endpoint: update note — customer edits own note", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateUpdateNote(data, "note_1", "updated content");
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("updates the note content", async () => {
		const ctrl = createOrderNotesController(data);
		const note = await ctrl.addNote({
			orderId: "order_1",
			content: "Original message",
			authorId: "cust_1",
			authorName: "Jane",
			authorType: "customer",
			isInternal: false,
		});

		const result = await simulateUpdateNote(data, note.id, "Updated message", {
			customerId: "cust_1",
		});

		expect("note" in result).toBe(true);
		if (!("note" in result)) {
			throw new Error("expected 'note' in result");
		}
		expect(result.note.content).toBe("Updated message");
		expect(result.note.id).toBe(note.id);
	});

	it("returns 404 for nonexistent note", async () => {
		const result = await simulateUpdateNote(data, "ghost_note", "content", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Note not found", status: 404 });
	});

	it("returns 404 when customer tries to update another customer's note", async () => {
		const ctrl = createOrderNotesController(data);
		const note = await ctrl.addNote({
			orderId: "order_1",
			content: "Jane's note",
			authorId: "cust_1",
			authorName: "Jane",
			authorType: "customer",
			isInternal: false,
		});

		const result = await simulateUpdateNote(data, note.id, "Tampered content", {
			customerId: "cust_2",
		});

		expect(result).toEqual({ error: "Note not found", status: 404 });
	});
});
