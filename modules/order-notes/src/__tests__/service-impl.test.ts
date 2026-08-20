import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createOrderNotesController } from "../service-impl";

describe("createOrderNotesController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createOrderNotesController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createOrderNotesController(mockData);
	});

	// ── addNote ─────────────────────────────────────────────────────────

	describe("addNote", () => {
		it("adds a customer note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John Doe",
				authorType: "customer",
				content: "Please deliver to the back door",
			});
			expect(note.id).toBeDefined();
			expect(note.orderId).toBe("order_1");
			expect(note.authorId).toBe("cust_1");
			expect(note.authorName).toBe("John Doe");
			expect(note.authorType).toBe("customer");
			expect(note.content).toBe("Please deliver to the back door");
			expect(note.isInternal).toBe(false);
			expect(note.isPinned).toBe(false);
			expect(note.createdAt).toBeInstanceOf(Date);
		});

		it("adds an admin note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin User",
				authorType: "admin",
				content: "Verified payment",
			});
			expect(note.authorType).toBe("admin");
		});

		it("adds an internal note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Customer flagged for review",
				isInternal: true,
			});
			expect(note.isInternal).toBe(true);
		});

		it("adds a system note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "system",
				authorName: "System",
				authorType: "system",
				content: "Order status changed to shipped",
			});
			expect(note.authorType).toBe("system");
		});

		it("allows multiple notes on the same order", async () => {
			const note1 = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "First note",
			});
			const note2 = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Second note",
			});
			expect(note1.id).not.toBe(note2.id);
		});
	});

	// ── updateNote ──────────────────────────────────────────────────────

	describe("updateNote", () => {
		it("updates own note content", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Original",
			});
			const updated = await controller.updateNote(
				note.id,
				"cust_1",
				"Updated content",
			);
			expect(updated).not.toBeNull();
			expect(updated?.content).toBe("Updated content");
		});

		it("rejects update from non-author (non-admin)", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Original",
			});
			const result = await controller.updateNote(
				note.id,
				"cust_2",
				"Hijacked",
				false,
			);
			expect(result).toBeNull();
		});

		it("allows admin to update any note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Original",
			});
			const updated = await controller.updateNote(
				note.id,
				"admin_1",
				"Admin edit",
				true,
			);
			expect(updated).not.toBeNull();
			expect(updated?.content).toBe("Admin edit");
		});

		it("returns null for nonexistent note", async () => {
			const result = await controller.updateNote(
				"nonexistent",
				"cust_1",
				"Content",
			);
			expect(result).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Original",
			});
			const updated = await controller.updateNote(note.id, "cust_1", "Updated");
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				note.updatedAt.getTime(),
			);
		});
	});

	// ── deleteNote ──────────────────────────────────────────────────────

	describe("deleteNote", () => {
		it("deletes own note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "To delete",
			});
			const result = await controller.deleteNote(note.id, "cust_1");
			expect(result).toBe(true);

			const found = await controller.getNote(note.id);
			expect(found).toBeNull();
		});

		it("rejects delete from non-author (non-admin)", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Protected",
			});
			const result = await controller.deleteNote(note.id, "cust_2", false);
			expect(result).toBe(false);
		});

		it("allows admin to delete any note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "To delete",
			});
			const result = await controller.deleteNote(note.id, "admin_1", true);
			expect(result).toBe(true);
		});

		it("returns false for nonexistent note", async () => {
			const result = await controller.deleteNote("nonexistent", "cust_1");
			expect(result).toBe(false);
		});
	});

	// ── togglePin ───────────────────────────────────────────────────────

	describe("togglePin", () => {
		it("pins an unpinned note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Important",
			});
			const pinned = await controller.togglePin(note.id);
			expect(pinned?.isPinned).toBe(true);
		});

		it("unpins a pinned note", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Important",
			});
			await controller.togglePin(note.id);
			const unpinned = await controller.togglePin(note.id);
			expect(unpinned?.isPinned).toBe(false);
		});

		it("returns null for nonexistent note", async () => {
			const result = await controller.togglePin("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── listByOrder ─────────────────────────────────────────────────────

	describe("listByOrder", () => {
		it("returns notes for an order", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Note 1",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Note 2",
			});
			await controller.addNote({
				orderId: "order_2",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Different order",
			});

			const notes = await controller.listByOrder("order_1");
			expect(notes).toHaveLength(2);
		});

		it("excludes internal notes by default", async () => {
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
				content: "Internal note",
				isInternal: true,
			});

			const notes = await controller.listByOrder("order_1");
			expect(notes).toHaveLength(1);
			expect(notes[0].content).toBe("Public note");
		});

		it("includes internal notes when requested", async () => {
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
				content: "Internal",
				isInternal: true,
			});

			const notes = await controller.listByOrder("order_1", {
				includeInternal: true,
			});
			expect(notes).toHaveLength(2);
		});

		it("sorts pinned notes first", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Regular note",
			});
			const important = await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Important pinned",
			});
			await controller.togglePin(important.id);

			const notes = await controller.listByOrder("order_1", {
				includeInternal: true,
			});
			expect(notes[0].isPinned).toBe(true);
			expect(notes[0].content).toBe("Important pinned");
		});

		it("returns empty array when no notes", async () => {
			const notes = await controller.listByOrder("order_1");
			expect(notes).toHaveLength(0);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.addNote({
					orderId: "order_1",
					authorId: "cust_1",
					authorName: "John",
					authorType: "customer",
					content: `Note ${i}`,
				});
			}
			const page = await controller.listByOrder("order_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countByOrder ────────────────────────────────────────────────────

	describe("countByOrder", () => {
		it("returns zero for order with no notes", async () => {
			const count = await controller.countByOrder("order_1");
			expect(count).toBe(0);
		});

		it("counts non-internal notes by default", async () => {
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
				content: "Internal",
				isInternal: true,
			});

			const count = await controller.countByOrder("order_1");
			expect(count).toBe(1);
		});

		it("counts all notes when includeInternal is true", async () => {
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
				content: "Internal",
				isInternal: true,
			});

			const count = await controller.countByOrder("order_1", true);
			expect(count).toBe(2);
		});
	});

	// ── getNote ─────────────────────────────────────────────────────────

	describe("getNote", () => {
		it("returns note by id", async () => {
			const note = await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Test",
			});
			const found = await controller.getNote(note.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(note.id);
		});

		it("returns null for nonexistent id", async () => {
			const found = await controller.getNote("nonexistent");
			expect(found).toBeNull();
		});
	});

	// ── listAll (admin) ─────────────────────────────────────────────────

	describe("listAll", () => {
		it("returns all notes", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Note 1",
			});
			await controller.addNote({
				orderId: "order_2",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Note 2",
				isInternal: true,
			});

			const result = await controller.listAll();
			expect(result.total).toBe(2);
			expect(result.items).toHaveLength(2);
		});

		it("filters by orderId", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Note 1",
			});
			await controller.addNote({
				orderId: "order_2",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Note 2",
			});

			const result = await controller.listAll({ orderId: "order_1" });
			expect(result.total).toBe(1);
		});

		it("filters by authorType", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Customer note",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Admin note",
			});

			const result = await controller.listAll({ authorType: "admin" });
			expect(result.total).toBe(1);
			expect(result.items[0].authorType).toBe("admin");
		});

		it("filters by isInternal", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Internal",
				isInternal: true,
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Public",
			});

			const result = await controller.listAll({ isInternal: true });
			expect(result.total).toBe(1);
			expect(result.items[0].isInternal).toBe(true);
		});
	});

	// ── getSummary (admin) ──────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns empty summary", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalNotes).toBe(0);
			expect(summary.notesPerOrder).toBe(0);
			expect(summary.internalCount).toBe(0);
			expect(summary.customerCount).toBe(0);
			expect(summary.adminCount).toBe(0);
		});

		it("returns accurate counts", async () => {
			await controller.addNote({
				orderId: "order_1",
				authorId: "cust_1",
				authorName: "John",
				authorType: "customer",
				content: "Customer note 1",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Admin note",
			});
			await controller.addNote({
				orderId: "order_1",
				authorId: "admin_1",
				authorName: "Admin",
				authorType: "admin",
				content: "Internal",
				isInternal: true,
			});
			await controller.addNote({
				orderId: "order_2",
				authorId: "cust_2",
				authorName: "Jane",
				authorType: "customer",
				content: "Customer note 2",
			});

			const summary = await controller.getSummary();
			expect(summary.totalNotes).toBe(4);
			expect(summary.notesPerOrder).toBe(2);
			expect(summary.internalCount).toBe(1);
			expect(summary.customerCount).toBe(2);
			expect(summary.adminCount).toBe(2);
		});
	});
});
