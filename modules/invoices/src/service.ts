import type { ModuleController } from "@86d-app/core/types/module";

/* ------------------------------------------------------------------ */
/*  Status types                                                       */
/* ------------------------------------------------------------------ */

export type InvoiceStatus =
	| "draft"
	| "sent"
	| "viewed"
	| "paid"
	| "partially_paid"
	| "overdue"
	| "void";

export type PaymentTerms =
	| "due_on_receipt"
	| "net_7"
	| "net_15"
	| "net_30"
	| "net_45"
	| "net_60"
	| "net_90";

export type PaymentMethod =
	| "card"
	| "bank_transfer"
	| "cash"
	| "check"
	| "store_credit"
	| "other";

export type CreditNoteStatus = "draft" | "issued" | "applied" | "void";

/* ------------------------------------------------------------------ */
/*  Model interfaces                                                   */
/* ------------------------------------------------------------------ */

export type BillingAddress = {
	firstName: string;
	lastName: string;
	company?: string | undefined;
	line1: string;
	line2?: string | undefined;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string | undefined;
};

export type Invoice = {
	id: string;
	invoiceNumber: string;
	orderId?: string;
	customerId?: string;
	guestEmail?: string;
	customerName?: string;
	status: InvoiceStatus;
	paymentTerms: PaymentTerms;
	issuedAt?: string;
	dueDate?: string;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	total: number;
	amountPaid: number;
	amountDue: number;
	currency: string;
	billingAddress?: BillingAddress;
	notes?: string;
	internalNotes?: string;
	metadata?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

export type InvoiceLineItem = {
	id: string;
	invoiceId: string;
	description: string;
	quantity: number;
	unitPrice: number;
	amount: number;
	sku?: string;
	productId?: string;
	sortOrder: number;
	createdAt: string;
};

export type InvoicePayment = {
	id: string;
	invoiceId: string;
	amount: number;
	method: PaymentMethod;
	reference?: string;
	notes?: string;
	paidAt: string;
	createdAt: string;
};

export type CreditNote = {
	id: string;
	invoiceId: string;
	creditNoteNumber: string;
	status: CreditNoteStatus;
	amount: number;
	reason?: string;
	notes?: string;
	issuedAt?: string;
	createdAt: string;
	updatedAt: string;
};

export type CreditNoteLineItem = {
	id: string;
	creditNoteId: string;
	description: string;
	quantity: number;
	unitPrice: number;
	amount: number;
	sortOrder: number;
	createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Composite types                                                    */
/* ------------------------------------------------------------------ */

export type InvoiceWithDetails = Invoice & {
	lineItems: InvoiceLineItem[];
	payments: InvoicePayment[];
	creditNotes: CreditNote[];
};

export type CreditNoteWithItems = CreditNote & {
	lineItems: CreditNoteLineItem[];
};

/* ------------------------------------------------------------------ */
/*  Param types                                                        */
/* ------------------------------------------------------------------ */

export type CreateInvoiceParams = {
	orderId?: string | undefined;
	customerId?: string | undefined;
	guestEmail?: string | undefined;
	customerName?: string | undefined;
	paymentTerms?: PaymentTerms | undefined;
	subtotal: number;
	taxAmount?: number | undefined;
	shippingAmount?: number | undefined;
	discountAmount?: number | undefined;
	currency?: string | undefined;
	billingAddress?: BillingAddress | undefined;
	notes?: string | undefined;
	internalNotes?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
	lineItems: CreateLineItemParams[];
};

export type CreateLineItemParams = {
	description: string;
	quantity: number;
	unitPrice: number;
	sku?: string | undefined;
	productId?: string | undefined;
};

export type UpdateInvoiceParams = {
	customerName?: string | undefined;
	guestEmail?: string | undefined;
	paymentTerms?: PaymentTerms | undefined;
	billingAddress?: BillingAddress | undefined;
	notes?: string | undefined;
	internalNotes?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
};

export type RecordPaymentParams = {
	invoiceId: string;
	amount: number;
	method: PaymentMethod;
	reference?: string | undefined;
	notes?: string | undefined;
	paidAt?: Date | undefined;
};

export type CreateCreditNoteParams = {
	invoiceId: string;
	reason?: string | undefined;
	notes?: string | undefined;
	lineItems: CreateCreditNoteLineItemParams[];
};

export type CreateCreditNoteLineItemParams = {
	description: string;
	quantity: number;
	unitPrice: number;
};

export type ListInvoiceParams = {
	limit?: number | undefined;
	offset?: number | undefined;
	status?: InvoiceStatus | undefined;
	search?: string | undefined;
	customerId?: string | undefined;
	orderId?: string | undefined;
};

/* ------------------------------------------------------------------ */
/*  Controller interface                                               */
/* ------------------------------------------------------------------ */

export type InvoiceController = ModuleController & {
	/* Invoice CRUD */
	create(params: CreateInvoiceParams): Promise<Invoice>;
	getById(id: string): Promise<InvoiceWithDetails | null>;
	getByNumber(invoiceNumber: string): Promise<InvoiceWithDetails | null>;
	list(params?: ListInvoiceParams): Promise<{
		invoices: Invoice[];
		total: number;
	}>;
	listForCustomer(
		customerId: string,
		params?: { limit?: number; offset?: number },
	): Promise<{ invoices: Invoice[]; total: number }>;
	update(id: string, params: UpdateInvoiceParams): Promise<Invoice | null>;
	delete(id: string): Promise<void>;

	/* Lifecycle */
	send(id: string): Promise<Invoice | null>;
	markViewed(id: string): Promise<Invoice | null>;
	markOverdue(id: string): Promise<Invoice | null>;
	voidInvoice(id: string): Promise<Invoice | null>;

	/* Line items */
	getLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
	addLineItem(
		invoiceId: string,
		item: CreateLineItemParams,
	): Promise<InvoiceLineItem>;
	removeLineItem(lineItemId: string): Promise<void>;

	/* Payments */
	recordPayment(params: RecordPaymentParams): Promise<InvoicePayment>;
	listPayments(invoiceId: string): Promise<InvoicePayment[]>;
	deletePayment(paymentId: string): Promise<void>;

	/* Credit notes */
	createCreditNote(params: CreateCreditNoteParams): Promise<CreditNote>;
	getCreditNote(id: string): Promise<CreditNoteWithItems | null>;
	listCreditNotes(invoiceId: string): Promise<CreditNoteWithItems[]>;
	issueCreditNote(id: string): Promise<CreditNote | null>;
	applyCreditNote(id: string): Promise<CreditNote | null>;
	voidCreditNote(id: string): Promise<CreditNote | null>;

	/* Bulk operations */
	bulkUpdateStatus(
		ids: string[],
		status: InvoiceStatus,
	): Promise<{ updated: number }>;
	bulkDelete(ids: string[]): Promise<{ deleted: number }>;

	/* Lookups */
	getByOrder(orderId: string): Promise<InvoiceWithDetails | null>;
	getByTracking(
		invoiceNumber: string,
		email: string,
	): Promise<InvoiceWithDetails | null>;

	/* Overdue detection */
	findOverdue(): Promise<Invoice[]>;
};
