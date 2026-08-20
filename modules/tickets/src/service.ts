import type { ModuleController } from "@86d-app/core/types/module";

export type TicketStatus =
	| "open"
	| "pending"
	| "in-progress"
	| "resolved"
	| "closed";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type MessageAuthorType = "customer" | "admin" | "system";

export type TicketCategory = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	position: number;
	isActive: boolean;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type Ticket = {
	id: string;
	number: number;
	categoryId?: string | undefined;
	subject: string;
	description: string;
	status: TicketStatus;
	priority: TicketPriority;
	customerEmail: string;
	customerName: string;
	customerId?: string | undefined;
	orderId?: string | undefined;
	assigneeId?: string | undefined;
	assigneeName?: string | undefined;
	tags?: string[] | undefined;
	metadata?: Record<string, unknown> | undefined;
	closedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type TicketMessage = {
	id: string;
	ticketId: string;
	body: string;
	authorType: MessageAuthorType;
	authorId?: string | undefined;
	authorName: string;
	authorEmail?: string | undefined;
	isInternal: boolean;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
};

export type TicketController = ModuleController & {
	/** Create a ticket category */
	createCategory(params: {
		name: string;
		slug: string;
		description?: string | undefined;
		position?: number | undefined;
	}): Promise<TicketCategory>;

	/** Get a category by ID */
	getCategory(id: string): Promise<TicketCategory | null>;

	/** List all categories */
	listCategories(opts?: {
		activeOnly?: boolean | undefined;
	}): Promise<TicketCategory[]>;

	/** Update a category */
	updateCategory(
		id: string,
		data: {
			name?: string | undefined;
			slug?: string | undefined;
			description?: string | undefined;
			position?: number | undefined;
			isActive?: boolean | undefined;
		},
	): Promise<TicketCategory>;

	/** Delete a category */
	deleteCategory(id: string): Promise<void>;

	/** Create a new support ticket */
	createTicket(params: {
		subject: string;
		description: string;
		categoryId?: string | undefined;
		priority?: TicketPriority | undefined;
		customerEmail: string;
		customerName: string;
		customerId?: string | undefined;
		orderId?: string | undefined;
		tags?: string[] | undefined;
	}): Promise<Ticket>;

	/** Get a ticket by ID */
	getTicket(id: string): Promise<Ticket | null>;

	/** Get a ticket by number */
	getTicketByNumber(num: number): Promise<Ticket | null>;

	/** List tickets with filters */
	listTickets(opts?: {
		status?: TicketStatus | undefined;
		priority?: TicketPriority | undefined;
		categoryId?: string | undefined;
		assigneeId?: string | undefined;
		customerEmail?: string | undefined;
		customerId?: string | undefined;
	}): Promise<Ticket[]>;

	/** Update a ticket */
	updateTicket(
		id: string,
		data: {
			subject?: string | undefined;
			categoryId?: string | undefined;
			status?: TicketStatus | undefined;
			priority?: TicketPriority | undefined;
			assigneeId?: string | undefined;
			assigneeName?: string | undefined;
			tags?: string[] | undefined;
		},
	): Promise<Ticket>;

	/** Close a ticket */
	closeTicket(id: string): Promise<Ticket>;

	/** Reopen a closed/resolved ticket */
	reopenTicket(id: string): Promise<Ticket>;

	/** Permanently delete a ticket and its messages */
	deleteTicket(id: string): Promise<boolean>;

	/** Add a message to a ticket */
	addMessage(params: {
		ticketId: string;
		body: string;
		authorType: MessageAuthorType;
		authorId?: string | undefined;
		authorName: string;
		authorEmail?: string | undefined;
		isInternal?: boolean | undefined;
	}): Promise<TicketMessage>;

	/** List messages for a ticket */
	listMessages(
		ticketId: string,
		opts?: {
			includeInternal?: boolean | undefined;
		},
	): Promise<TicketMessage[]>;

	/** Get ticket statistics */
	getStats(): Promise<{
		total: number;
		open: number;
		pending: number;
		inProgress: number;
		resolved: number;
		closed: number;
		byPriority: Record<TicketPriority, number>;
	}>;
};
