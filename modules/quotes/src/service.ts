import type { ModuleController } from "@86d-app/core/types/module";

export type QuoteStatus =
	| "draft"
	| "submitted"
	| "under_review"
	| "countered"
	| "accepted"
	| "rejected"
	| "expired"
	| "converted";

export type AuthorType = "customer" | "admin";

export type Quote = {
	id: string;
	customerId: string;
	customerEmail: string;
	customerName: string;
	companyName?: string | undefined;
	status: QuoteStatus;
	notes?: string | undefined;
	adminNotes?: string | undefined;
	subtotal: number;
	discount: number;
	total: number;
	expiresAt?: Date | undefined;
	convertedOrderId?: string | undefined;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type QuoteItem = {
	id: string;
	quoteId: string;
	productId: string;
	productName: string;
	sku?: string | undefined;
	quantity: number;
	unitPrice: number;
	offeredPrice?: number | undefined;
	notes?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type QuoteComment = {
	id: string;
	quoteId: string;
	authorType: AuthorType;
	authorId: string;
	authorName: string;
	message: string;
	createdAt: Date;
};

export type QuoteHistory = {
	id: string;
	quoteId: string;
	fromStatus: string;
	toStatus: string;
	changedBy: string;
	reason?: string | undefined;
	createdAt: Date;
};

export type QuoteStats = {
	totalQuotes: number;
	draftQuotes: number;
	submittedQuotes: number;
	underReviewQuotes: number;
	counteredQuotes: number;
	acceptedQuotes: number;
	rejectedQuotes: number;
	expiredQuotes: number;
	convertedQuotes: number;
	totalValue: number;
	averageValue: number;
	conversionRate: number;
};

export type QuoteController = ModuleController & {
	// Quote lifecycle
	createQuote(params: {
		customerId: string;
		customerEmail: string;
		customerName: string;
		companyName?: string | undefined;
		notes?: string | undefined;
	}): Promise<Quote>;

	getQuote(id: string): Promise<Quote | null>;

	getMyQuotes(params: {
		customerId: string;
		status?: QuoteStatus | undefined;
		skip?: number | undefined;
		take?: number | undefined;
	}): Promise<Quote[]>;

	submitQuote(id: string): Promise<Quote | null>;

	acceptQuote(id: string): Promise<Quote | null>;

	declineQuote(id: string, reason?: string | undefined): Promise<Quote | null>;

	// Items
	addItem(params: {
		quoteId: string;
		productId: string;
		productName: string;
		sku?: string | undefined;
		quantity: number;
		unitPrice: number;
		notes?: string | undefined;
	}): Promise<QuoteItem | null>;

	updateItem(
		quoteId: string,
		itemId: string,
		params: {
			quantity?: number | undefined;
			unitPrice?: number | undefined;
			notes?: string | undefined;
		},
	): Promise<QuoteItem | null>;

	removeItem(quoteId: string, itemId: string): Promise<boolean>;

	getItems(quoteId: string): Promise<QuoteItem[]>;

	// Comments
	addComment(params: {
		quoteId: string;
		authorType: AuthorType;
		authorId: string;
		authorName: string;
		message: string;
	}): Promise<QuoteComment>;

	getComments(quoteId: string): Promise<QuoteComment[]>;

	// Admin operations
	listQuotes(params?: {
		status?: QuoteStatus | undefined;
		customerId?: string | undefined;
		skip?: number | undefined;
		take?: number | undefined;
	}): Promise<Quote[]>;

	reviewQuote(id: string): Promise<Quote | null>;

	counterQuote(
		id: string,
		params: {
			items: Array<{ itemId: string; offeredPrice: number }>;
			expiresAt?: Date | undefined;
			adminNotes?: string | undefined;
		},
	): Promise<Quote | null>;

	approveAsIs(
		id: string,
		params?: {
			expiresAt?: Date | undefined;
			adminNotes?: string | undefined;
		},
	): Promise<Quote | null>;

	rejectQuote(id: string, reason?: string | undefined): Promise<Quote | null>;

	convertToOrder(id: string, orderId: string): Promise<Quote | null>;

	expireQuote(id: string): Promise<Quote | null>;

	// Admin delete
	deleteQuote(id: string): Promise<boolean>;

	// History
	getHistory(quoteId: string): Promise<QuoteHistory[]>;

	// Stats
	getStats(): Promise<QuoteStats>;
};
