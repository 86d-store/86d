export interface Order {
	id: string;
	orderNumber: string;
	customerId: string;
	status: string;
	paymentStatus: string;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	total: number;
	currency: string;
	notes?: string | undefined;
	createdAt: string;
	updatedAt: string;
}

export interface OrderItem {
	id: string;
	orderId: string;
	productId: string;
	variantId?: string | undefined;
	name: string;
	sku?: string | undefined;
	price: number;
	quantity: number;
	subtotal: number;
}

export interface OrderAddress {
	id: string;
	orderId: string;
	type: string;
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
}

export interface OrderWithDetails extends Order {
	items: OrderItem[];
	addresses: OrderAddress[];
}

export interface OrderListResponse {
	orders: Order[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

export interface FulfillmentItem {
	id: string;
	fulfillmentId: string;
	orderItemId: string;
	quantity: number;
}

export interface FulfillmentWithItems {
	id: string;
	orderId: string;
	status: string;
	trackingNumber?: string | null;
	trackingUrl?: string | null;
	carrier?: string | null;
	shippedAt?: string | null;
	deliveredAt?: string | null;
	createdAt: string;
	items: FulfillmentItem[];
}

export interface ReturnItemData {
	id: string;
	returnRequestId: string;
	orderItemId: string;
	quantity: number;
	reason?: string | null;
}

export interface ReturnRequestWithItems {
	id: string;
	orderId: string;
	status: string;
	type: string;
	reason: string;
	customerNotes?: string | null;
	adminNotes?: string | null;
	refundAmount?: number | null;
	trackingNumber?: string | null;
	trackingUrl?: string | null;
	carrier?: string | null;
	createdAt: string;
	items: ReturnItemData[];
}
