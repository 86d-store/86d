import { describe, expect, it, vi } from "vitest";
import { adminAddNote } from "../admin/endpoints/admin-add-note";
import { adminDeleteNote } from "../admin/endpoints/admin-delete-note";
import { listAllNotes } from "../admin/endpoints/list-all-notes";
import { notesSummary } from "../admin/endpoints/notes-summary";
import { togglePin } from "../admin/endpoints/toggle-pin";
import type {
	OrderNote,
	OrderNoteSummary,
	OrderNotesController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeNote(overrides: Partial<OrderNote> = {}): OrderNote {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		orderId: "order-1",
		authorId: "admin-1",
		authorName: "Admin",
		authorType: "admin",
		content: "Order dispatched.",
		isInternal: false,
		isPinned: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<OrderNotesController> = {},
): OrderNotesController {
	const defaultSummary: OrderNoteSummary = {
		totalNotes: 0,
		notesPerOrder: 0,
		internalCount: 0,
		customerCount: 0,
		adminCount: 0,
	};
	return {
		addNote: vi.fn().mockResolvedValue(makeNote()),
		updateNote: vi.fn().mockResolvedValue(null),
		deleteNote: vi.fn().mockResolvedValue(false),
		togglePin: vi.fn().mockResolvedValue(null),
		listByOrder: vi.fn().mockResolvedValue([]),
		countByOrder: vi.fn().mockResolvedValue(0),
		getNote: vi.fn().mockResolvedValue(null),
		listAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		getSummary: vi.fn().mockResolvedValue(defaultSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: OrderNotesController;
		session?: Record<string, unknown>;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { orderNotes: opts.controller ?? makeController() },
			session: opts.session ?? {
				user: { id: "admin-1", name: "Admin", email: "admin@86d.app" },
			},
		},
	});
}

const listHandler = extractHandler(listAllNotes);
const addHandler = extractHandler(adminAddNote);
const deleteHandler = extractHandler(adminDeleteNote);
const togglePinHandler = extractHandler(togglePin);
const summaryHandler = extractHandler(notesSummary);

describe("admin GET /order-notes", () => {
	it("returns empty items and zero total", async () => {
		const result = (await call(listHandler)) as {
			items: OrderNote[];
			total: number;
		};
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards orderId filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { orderId: "order-99" },
			controller: ctrl,
		});
		expect(ctrl.listAll).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: "order-99" }),
		);
	});
});

describe("admin POST /order-notes/add", () => {
	it("adds note and returns it", async () => {
		const note = makeNote({ content: "Checked and packed." });
		const ctrl = makeController({ addNote: vi.fn().mockResolvedValue(note) });
		const result = (await call(addHandler, {
			body: { orderId: "order-1", content: "Checked and packed." },
			controller: ctrl,
		})) as { note: OrderNote };
		expect(result.note.content).toBe("Checked and packed.");
	});

	it("uses session user as author when session available", async () => {
		const ctrl = makeController();
		await call(addHandler, {
			body: { orderId: "order-1", content: "Internal note.", isInternal: true },
			controller: ctrl,
			session: {
				user: { id: "admin-42", name: "Bob", email: "bob@example.com" },
			},
		});
		expect(ctrl.addNote).toHaveBeenCalledWith(
			expect.objectContaining({ authorId: "admin-42", isInternal: true }),
		);
	});
});

describe("admin POST /order-notes/:id/delete", () => {
	it("returns 404 when note not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns success when note is deleted", async () => {
		const ctrl = makeController({
			deleteNote: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "note-1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /order-notes/:id/toggle-pin", () => {
	it("returns 404 when note not found", async () => {
		const result = (await call(togglePinHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated note after pin toggle", async () => {
		const note = makeNote({ isPinned: true });
		const ctrl = makeController({ togglePin: vi.fn().mockResolvedValue(note) });
		const result = (await call(togglePinHandler, {
			params: { id: note.id },
			controller: ctrl,
		})) as { note: OrderNote };
		expect(result.note.isPinned).toBe(true);
	});
});

describe("admin GET /order-notes/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as OrderNoteSummary;
		expect(result.totalNotes).toBe(0);
	});

	it("returns real summary stats", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalNotes: 50,
				notesPerOrder: 2.5,
				internalCount: 20,
				customerCount: 10,
				adminCount: 20,
			}),
		});
		const result = (await call(summaryHandler, {
			controller: ctrl,
		})) as OrderNoteSummary;
		expect(result.totalNotes).toBe(50);
		expect(result.adminCount).toBe(20);
	});
});
