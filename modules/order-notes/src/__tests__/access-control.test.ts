import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createOrderNotesController } from "../service-impl";

describe("order-notes access control", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createOrderNotesController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createOrderNotesController(mockData);
	});

	// ── customer cannot see internal notes ──────────────────────────────

	describe("internal note visibility", () => {
		it("hides internal notes from customers", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Public note",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Secret internal note",
				isInternal: true,
			});

			const customerView = await controller.listByOrder("order_1", {
				includeInternal: false,
			});
			expect(customerView).toHaveLength(1);
			expect(customerView[0].content).toBe("Public note");
		});

		it("shows internal notes to admins", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Internal",
				isInternal: true,
			});

			const adminView = await controller.listByOrder("order_1", {
				includeInternal: true,
			});
			expect(adminView).toHaveLength(1);
			expect(adminView[0].isInternal).toBe(true);
		});

		it("count excludes internal notes for customers", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Public",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Secret",
				isInternal: true,
			});

			const customerCount = await controller.countByOrder("order_1", false);
			expect(customerCount).toBe(1);

			const adminCount = await controller.countByOrder("order_1", true);
			expect(adminCount).toBe(2);
		});
	});

	// ── note authorship enforcement ─────────────────────────────────────

	describe("authorship enforcement", () => {
		it("customer can only edit own notes", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "My note",
			});

			const updated = await controller.updateNote(
				note.id,
				"cust_1",
				"Updated",
				false,
			);
			expect(updated?.content).toBe("Updated");

			const hijacked = await controller.updateNote(
				note.id,
				"cust_2",
				"Hijacked",
				false,
			);
			expect(hijacked).toBeNull();
		});

		it("customer can only delete own notes", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "My note",
			});

			const denied = await controller.deleteNote(note.id, "cust_2", false);
			expect(denied).toBe(false);

			const deleted = await controller.deleteNote(note.id, "cust_1", false);
			expect(deleted).toBe(true);
		});

		it("admin can edit any customer note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Customer note",
			});

			const updated = await controller.updateNote(
				note.id,
				"admin_1",
				"Admin corrected",
				true,
			);
			expect(updated?.content).toBe("Admin corrected");
		});

		it("admin can delete any note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Customer note",
			});

			const deleted = await controller.deleteNote(note.id, "admin_1", true);
			expect(deleted).toBe(true);
		});
	});

	// ── pin/unpin ───────────────────────────────────────────────────────

	describe("pin behavior", () => {
		it("pinned notes appear first in list", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "First",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Second",
			});
			const note3 = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Third - pinned",
			});

			await controller.togglePin(note3.id);

			const notes = await controller.listByOrder("order_1");
			expect(notes[0].content).toBe("Third - pinned");
			expect(notes[0].isPinned).toBe(true);
		});

		it("multiple pins maintain order among pinned", async () => {
			const n1 = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Pin A",
			});
			const n2 = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Pin B",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Not pinned",
			});

			await controller.togglePin(n1.id);
			await controller.togglePin(n2.id);

			const notes = await controller.listByOrder("order_1");
			expect(notes[0].isPinned).toBe(true);
			expect(notes[1].isPinned).toBe(true);
			expect(notes[2].isPinned).toBe(false);
		});
	});

	// ── cross-order isolation ───────────────────────────────────────────

	describe("cross-order isolation", () => {
		it("notes are scoped to their order", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Order 1 note",
			});
			await controller.addNote({
				orderId: "order_2",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Order 2 note",
			});

			const order1Notes = await controller.listByOrder("order_1");
			const order2Notes = await controller.listByOrder("order_2");

			expect(order1Notes).toHaveLength(1);
			expect(order1Notes[0].content).toBe("Order 1 note");
			expect(order2Notes).toHaveLength(1);
			expect(order2Notes[0].content).toBe("Order 2 note");
		});

		it("count is per-order", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Note A",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Note B",
			});
			await controller.addNote({
				orderId: "order_2",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Note C",
			});

			const count1 = await controller.countByOrder("order_1");
			const count2 = await controller.countByOrder("order_2");
			expect(count1).toBe(2);
			expect(count2).toBe(1);
		});
	});
});
