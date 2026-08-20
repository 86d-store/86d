import type { ModuleController } from "@86d-app/core/types/module";

export type OrderStatus =
	| "pending"
	| "processing"
	| "on_hold"
	| "completed"
	| "cancelled"
	| "refunded";

export type PaymentStatus =
	| "unpaid"
	| "paid"
	| "partially_paid"
	| "refunded"
	| "voided";

export type Order = {
	id: string;
	orderNumber: string;
	customerId?: string | undefined;
	guestEmail?: string | undefined;
	status: OrderStatus;
	paymentStatus: PaymentStatus;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	storeCreditAmount: number;
	total: number;
	currency: string;
	checkoutId?: string | undefined;
	acceptedOfferId?: string | undefined;
	catalogRevision?: string | undefined;
	priceSourceVersion?: string | undefined;
	taxQuoteId?: string | undefined;
	shippingQuoteId?: string | undefined;
	shippingOptionId?: string | undefined;
	inventoryReservationIds?: string[] | undefined;
	paymentConnectionId?: string | undefined;
	paymentOperationId?: string | undefined;
	closedAt?: Date | undefined;
	closureReason?: string | undefined;
	closurePolicyVersion?: number | undefined;
	notes?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type OrderItem = {
	id: string;
	orderId: string;
	productId: string;
	variantId?: string | undefined;
	name: string;
	sku?: string | undefined;
	price: number;
	quantity: number;
	subtotal: number;
	metadata?: Record<string, unknown> | undefined;
};

export type OrderAddress = {
	id: string;
	orderId: string;
	type: "billing" | "shipping";
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

export type OrderWithDetails = Order & {
	items: OrderItem[];
	addresses: OrderAddress[];
};

export type CreateOrderParams = {
	id?: string | undefined;
	customerId?: string | undefined;
	guestEmail?: string | undefined;
	currency?: string | undefined;
	checkoutId?: string | undefined;
	acceptedOfferId?: string | undefined;
	catalogRevision?: string | undefined;
	priceSourceVersion?: string | undefined;
	taxQuoteId?: string | undefined;
	shippingQuoteId?: string | undefined;
	shippingOptionId?: string | undefined;
	inventoryReservationIds?: string[] | undefined;
	paymentConnectionId?: string | undefined;
	paymentOperationId?: string | undefined;
	paymentStatus?: PaymentStatus | undefined;
	subtotal: number;
	taxAmount?: number | undefined;
	shippingAmount?: number | undefined;
	discountAmount?: number | undefined;
	giftCardAmount?: number | undefined;
	storeCreditAmount?: number | undefined;
	total: number;
	notes?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
	items: Array<{
		productId: string;
		variantId?: string | undefined;
		name: string;
		sku?: string | undefined;
		price: number;
		quantity: number;
	}>;
	billingAddress?: Omit<OrderAddress, "id" | "orderId" | "type"> | undefined;
	shippingAddress?: Omit<OrderAddress, "id" | "orderId" | "type"> | undefined;
};

export type FulfillmentStatus =
	| "pending"
	| "processing"
	| "shipped"
	| "delivered"
	| "cancelled";

export type Fulfillment = {
	id: string;
	orderId: string;
	status: FulfillmentStatus;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
	carrier?: string | undefined;
	notes?: string | undefined;
	shippedAt?: Date | undefined;
	deliveredAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type FulfillmentItem = {
	id: string;
	fulfillmentId: string;
	orderItemId: string;
	quantity: number;
};

export type FulfillmentWithItems = Fulfillment & {
	items: FulfillmentItem[];
};

export type OrderFulfillmentStatus =
	| "unfulfilled"
	| "partially_fulfilled"
	| "fulfilled";

export type ReturnStatus =
	| "requested"
	| "approved"
	| "rejected"
	| "shipped_back"
	| "received"
	| "refunded"
	| "completed";

export type ReturnType = "refund" | "exchange" | "store_credit";

export const RETURN_REASONS = [
	"defective",
	"wrong_item",
	"not_as_described",
	"changed_mind",
	"too_small",
	"too_large",
	"arrived_late",
	"damaged_in_shipping",
	"other",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export type ReturnRequest = {
	id: string;
	orderId: string;
	status: ReturnStatus;
	type: ReturnType;
	reason: string;
	customerNotes?: string | undefined;
	adminNotes?: string | undefined;
	refundAmount?: number | undefined;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
	carrier?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ReturnItem = {
	id: string;
	returnRequestId: string;
	orderItemId: string;
	quantity: number;
	reason?: string | undefined;
};

export type ReturnRequestWithItems = ReturnRequest & {
	items: ReturnItem[];
};

export type CreateReturnParams = {
	orderId: string;
	type?: ReturnType | undefined;
	reason: string;
	customerNotes?: string | undefined;
	items: Array<{
		orderItemId: string;
		quantity: number;
		reason?: string | undefined;
	}>;
};

export type UpdateReturnParams = {
	status?: ReturnStatus | undefined;
	adminNotes?: string | undefined;
	refundAmount?: number | undefined;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
	carrier?: string | undefined;
};

export type OrderNoteType = "note" | "system";

export type OrderNote = {
	id: string;
	orderId: string;
	type: OrderNoteType;
	content: string;
	authorId?: string | undefined;
	authorName?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
};

export type AddNoteParams = {
	orderId: string;
	content: string;
	type?: OrderNoteType | undefined;
	authorId?: string | undefined;
	authorName?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
};

export type InvoiceData = {
	invoiceNumber: string;
	orderNumber: string;
	orderId: string;
	issueDate: string;
	dueDate: string;
	status: "draft" | "issued" | "paid" | "void";
	customerName: string;
	customerEmail?: string | undefined;
	billingAddress?: Omit<OrderAddress, "id" | "orderId" | "type"> | undefined;
	shippingAddress?: Omit<OrderAddress, "id" | "orderId" | "type"> | undefined;
	lineItems: Array<{
		name: string;
		sku?: string | undefined;
		quantity: number;
		unitPrice: number;
		subtotal: number;
	}>;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	storeCreditAmount: number;
	total: number;
	currency: string;
	storeName: string;
	notes?: string | undefined;
};

export type ReorderItem = {
	productId: string;
	variantId?: string | undefined;
	name: string;
	sku?: string | undefined;
	price: number;
	quantity: number;
};

// ── Cross-module controller interfaces (for cancel side effects) ─────────────

/** Minimal payment controller needed for refunding on order cancellation. */
export type PaymentRefundController = {
	listIntents(params: {
		orderId?: string | undefined;
		status?: string | undefined;
	}): Promise<
		Array<{
			id: string;
			status: string;
			amount: number;
		}>
	>;
	createRefund(params: {
		intentId: string;
		amount?: number | undefined;
		reason?: string | undefined;
	}): Promise<{ id: string; amount: number; status: string }>;
};

/** Minimal inventory controller needed for releasing stock on cancellation. */
export type InventoryReleaseController = {
	release(params: {
		productId: string;
		variantId?: string | undefined;
		quantity: number;
	}): Promise<unknown>;
};

/** Minimal customer controller needed for resolving contact info on status changes. */
export type CustomerLookupController = {
	getById(id: string): Promise<{
		email: string;
		firstName: string;
		lastName: string;
	} | null>;
};

export type OrderController = ModuleController & {
	/**
	 * Create a new order
	 */
	create(params: CreateOrderParams): Promise<Order>;

	/**
	 * Get an order by ID with all details
	 */
	getById(id: string): Promise<OrderWithDetails | null>;

	/**
	 * Get an order by order number
	 */
	getByOrderNumber(orderNumber: string): Promise<OrderWithDetails | null>;

	/**
	 * List orders for a customer
	 */
	listForCustomer(
		customerId: string,
		params?: { limit?: number; offset?: number },
	): Promise<{ orders: Order[]; total: number }>;

	/**
	 * Rewrite legacy auth-subject customerId values onto the Store Customer.
	 */
	adoptLegacySubjectOrders(
		authSubject: string,
		storeCustomerId: string,
	): Promise<number>;

	/**
	 * Bind a guest Order to a Store Customer after proof verification.
	 */
	claimGuestOrder(params: {
		orderId: string;
		storeCustomerId: string;
		proofs: readonly string[];
	}): Promise<
		| { ok: true; order: Order; claimed: boolean }
		| {
				ok: false;
				code:
					| "order_not_found"
					| "proof_invalid"
					| "already_attributed"
					| "not_guest_order";
		  }
	>;

	guestProofMatches(order: Order, proofs: readonly string[]): Promise<boolean>;

	/**
	 * Check if a customer has ever purchased a specific product.
	 * Used for verified-purchase review gating.
	 */
	hasCustomerPurchasedProduct(
		customerId: string,
		productId: string,
	): Promise<boolean>;

	/**
	 * List all orders (admin)
	 */
	list(params: {
		limit?: number | undefined;
		offset?: number | undefined;
		search?: string | undefined;
		status?: OrderStatus | undefined;
		paymentStatus?: PaymentStatus | undefined;
	}): Promise<{ orders: Order[]; total: number }>;

	/**
	 * List orders with full details (items + addresses) for export
	 */
	listForExport(params: {
		limit?: number | undefined;
		offset?: number | undefined;
		search?: string | undefined;
		status?: OrderStatus | undefined;
		paymentStatus?: PaymentStatus | undefined;
		dateFrom?: Date | undefined;
		dateTo?: Date | undefined;
	}): Promise<{ orders: OrderWithDetails[]; total: number }>;

	/**
	 * Update order status
	 */
	updateStatus(id: string, status: OrderStatus): Promise<Order | null>;

	/**
	 * Update payment status
	 */
	updatePaymentStatus(
		id: string,
		paymentStatus: PaymentStatus,
	): Promise<Order | null>;

	/**
	 * Update order notes/metadata
	 */
	update(
		id: string,
		params: {
			notes?: string | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<Order | null>;

	/**
	 * Cancel an order (only if cancellable)
	 */
	cancel(id: string): Promise<Order | null>;

	/**
	 * Delete an order (admin only, hard delete)
	 */
	delete(id: string): Promise<void>;

	/**
	 * Get order items
	 */
	getItems(orderId: string): Promise<OrderItem[]>;

	/**
	 * Get order addresses
	 */
	getAddresses(orderId: string): Promise<OrderAddress[]>;

	/**
	 * Create a return request for an order
	 */
	createReturn(params: CreateReturnParams): Promise<ReturnRequest>;

	/**
	 * Get a return request by ID with its items
	 */
	getReturn(id: string): Promise<ReturnRequestWithItems | null>;

	/**
	 * List return requests for an order
	 */
	listReturns(orderId: string): Promise<ReturnRequestWithItems[]>;

	/**
	 * List all return requests (admin)
	 */
	listAllReturns(params: {
		limit?: number | undefined;
		offset?: number | undefined;
		status?: ReturnStatus | undefined;
	}): Promise<{ returns: ReturnRequestWithItems[]; total: number }>;

	/**
	 * Update a return request (admin)
	 */
	updateReturn(
		id: string,
		params: UpdateReturnParams,
	): Promise<ReturnRequest | null>;

	/**
	 * Delete a return request
	 */
	deleteReturn(id: string): Promise<void>;

	// ── Bulk Operations ───────────────────────────────────────────────────

	/**
	 * Bulk update order status
	 */
	bulkUpdateStatus(
		ids: string[],
		status: OrderStatus,
	): Promise<{ updated: number }>;

	/**
	 * Bulk update payment status
	 */
	bulkUpdatePaymentStatus(
		ids: string[],
		paymentStatus: PaymentStatus,
	): Promise<{ updated: number }>;

	/**
	 * Bulk delete orders
	 */
	bulkDelete(ids: string[]): Promise<{ deleted: number }>;

	// ── Order Notes ──────────────────────────────────────────────────────

	/**
	 * Add a note or system event to an order
	 */
	addNote(params: AddNoteParams): Promise<OrderNote>;

	/**
	 * List all notes for an order (newest first)
	 */
	listNotes(orderId: string): Promise<OrderNote[]>;

	/**
	 * Delete a note by ID
	 */
	deleteNote(id: string): Promise<void>;

	// ── Invoice ─────────────────────────────────────────────────────────

	/**
	 * Get invoice data for an order
	 */
	getInvoiceData(
		orderId: string,
		storeName: string,
	): Promise<InvoiceData | null>;

	// ── Customer Returns ──────────────────────────────────────────────

	/**
	 * List all return requests for a customer across all their orders
	 */
	listReturnsForCustomer(
		customerId: string,
		params?: {
			limit?: number | undefined;
			offset?: number | undefined;
			status?: ReturnStatus | undefined;
		},
	): Promise<{
		returns: Array<ReturnRequestWithItems & { orderNumber: string }>;
		total: number;
	}>;

	// ── Public Order Tracking ──────────────────────────────────────────

	/**
	 * Look up an order by order number + email for guest tracking.
	 * Returns the order only if the email matches either guestEmail or
	 * the billing address email (case-insensitive).
	 */
	getByTracking(
		orderNumber: string,
		email: string,
	): Promise<OrderWithDetails | null>;

	// ── Reorder ──────────────────────────────────────────────────────────

	/**
	 * Extract cart-ready items from a previous order for reordering.
	 * Returns the line items with productId, variantId, name, sku, price, and quantity.
	 */
	getReorderItems(orderId: string): Promise<ReorderItem[] | null>;
};
