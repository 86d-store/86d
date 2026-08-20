import type { ModuleController } from "@86d-app/core/types/module";

export type AuthorType = "customer" | "admin" | "system";

export type OrderNote = {
	id: string;
	orderId: string;
	authorId: string;
	authorName: string;
	authorType: AuthorType;
	content: string;
	/** Internal notes are visible only to admins. */
	isInternal: boolean;
	/** Pinned notes appear at the top. */
	isPinned: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type OrderNoteSummary = {
	totalNotes: number;
	notesPerOrder: number;
	internalCount: number;
	customerCount: number;
	adminCount: number;
};

export type OrderNotesController = ModuleController & {
	/** Add a note to an order. */
	addNote(params: {
		orderId: string;
		authorId: string;
		authorName: string;
		authorType: AuthorType;
		content: string;
		isInternal?: boolean | undefined;
	}): Promise<OrderNote>;

	/** Update note content. Only the original author or admin can update. */
	updateNote(
		noteId: string,
		authorId: string,
		content: string,
		isAdmin?: boolean | undefined,
	): Promise<OrderNote | null>;

	/** Delete a note. Only the original author or admin can delete. */
	deleteNote(
		noteId: string,
		authorId: string,
		isAdmin?: boolean | undefined,
	): Promise<boolean>;

	/** Pin/unpin a note (admin only). */
	togglePin(noteId: string): Promise<OrderNote | null>;

	/** Get all notes for an order. Customers only see non-internal notes. */
	listByOrder(
		orderId: string,
		params?: {
			includeInternal?: boolean | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<OrderNote[]>;

	/** Count notes for an order. */
	countByOrder(
		orderId: string,
		includeInternal?: boolean | undefined,
	): Promise<number>;

	/** Get a single note by ID. */
	getNote(noteId: string): Promise<OrderNote | null>;

	/** Admin: list all notes with filters. */
	listAll(params?: {
		orderId?: string | undefined;
		authorType?: AuthorType | undefined;
		isInternal?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<{ items: OrderNote[]; total: number }>;

	/** Admin: summary stats. */
	getSummary(): Promise<OrderNoteSummary>;
};
