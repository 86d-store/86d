import type { ModuleDataService } from "@86d-app/core/types/module";
import type { AuthorType, OrderNote, OrderNotesController } from "./service";

export function createOrderNotesController(
	data: ModuleDataService,
): OrderNotesController {
	return {
		async addNote(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const note: OrderNote = {
				id,
				orderId: params.orderId,
				authorId: params.authorId,
				authorName: params.authorName,
				authorType: params.authorType as AuthorType,
				content: params.content,
				isInternal: params.isInternal ?? false,
				isPinned: false,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("orderNote", id, { ...note });
			return note;
		},

		async updateNote(noteId, authorId, content, isAdmin) {
			const note = await this.getNote(noteId);
			if (!note) return null;
			if (!isAdmin && note.authorId !== authorId) return null;

			const updated: OrderNote = {
				...note,
				content,
				updatedAt: new Date(),
			};

			await data.upsert("orderNote", noteId, { ...updated });
			return updated;
		},

		async deleteNote(noteId, authorId, isAdmin) {
			const note = await this.getNote(noteId);
			if (!note) return false;
			if (!isAdmin && note.authorId !== authorId) return false;

			await data.delete("orderNote", noteId);
			return true;
		},

		async togglePin(noteId) {
			const note = await this.getNote(noteId);
			if (!note) return null;

			const updated: OrderNote = {
				...note,
				isPinned: !note.isPinned,
				updatedAt: new Date(),
			};

			await data.upsert("orderNote", noteId, { ...updated });
			return updated;
		},

		async listByOrder(orderId, params) {
			const where: Record<string, unknown> = { orderId };
			if (!params?.includeInternal) {
				where.isInternal = false;
			}

			const results = await data.findMany("orderNote", {
				where,
				take: params?.take ?? 100,
				skip: params?.skip ?? 0,
				orderBy: { createdAt: "desc" },
			});
			const notes = results as unknown as OrderNote[];

			// Sort pinned notes first
			return notes.sort((a, b) => {
				if (a.isPinned && !b.isPinned) return -1;
				if (!a.isPinned && b.isPinned) return 1;
				return 0;
			});
		},

		async countByOrder(orderId, includeInternal) {
			const where: Record<string, unknown> = { orderId };
			if (!includeInternal) {
				where.isInternal = false;
			}
			const results = await data.findMany("orderNote", { where });
			return results.length;
		},

		async getNote(noteId) {
			const results = await data.findMany("orderNote", {
				where: { id: noteId },
				take: 1,
			});
			const notes = results as unknown as OrderNote[];
			return notes[0] ?? null;
		},

		async listAll(params) {
			const where: Record<string, unknown> = {};
			if (params?.orderId) where.orderId = params.orderId;
			if (params?.authorType) where.authorType = params.authorType;
			if (params?.isInternal !== undefined)
				where.isInternal = params.isInternal;

			const results = await data.findMany("orderNote", {
				where,
				take: params?.take ?? 50,
				skip: params?.skip ?? 0,
				orderBy: { createdAt: "desc" },
			});
			const items = results as unknown as OrderNote[];

			const allResults = await data.findMany("orderNote", { where });
			return { items, total: allResults.length };
		},

		async getSummary() {
			const all = await data.findMany("orderNote", {});
			const notes = all as unknown as OrderNote[];

			const orderIds = new Set(notes.map((n) => n.orderId));
			const internalCount = notes.filter((n) => n.isInternal).length;
			const customerCount = notes.filter(
				(n) => n.authorType === "customer",
			).length;
			const adminCount = notes.filter((n) => n.authorType === "admin").length;

			return {
				totalNotes: notes.length,
				notesPerOrder:
					orderIds.size > 0
						? Math.round((notes.length / orderIds.size) * 10) / 10
						: 0,
				internalCount,
				customerCount,
				adminCount,
			};
		},
	};
}
