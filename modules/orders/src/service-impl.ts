import type {
	ModuleContext,
	ModuleDataService,
} from "@86d-app/core/types/module";
import type {
	AddNoteParams,
	CreateOrderParams,
	CreateReturnParams,
	InvoiceData,
	Order,
	OrderAddress,
	OrderController,
	OrderItem,
	OrderNote,
	OrderStatus,
	OrderWithDetails,
	PaymentStatus,
	ReorderItem,
	ReturnItem,
	ReturnRequest,
	ReturnRequestWithItems,
	ReturnStatus,
	UpdateReturnParams,
} from "./service";
import { orderAcceptsGuestProof } from "./store/endpoints/guest-proof";

/** Generate a sequential-looking order number */
function generateOrderNumber(): string {
	const timestamp = Date.now().toString(36).toUpperCase();
	const random = Math.random().toString(36).substring(2, 6).toUpperCase();
	return `ORD-${timestamp}-${random}`;
}

/** Status transitions — which statuses can transition to which */
const CANCELLABLE_STATUSES: OrderStatus[] = [
	"pending",
	"processing",
	"on_hold",
];

/** Generate an invoice number from order number and date */
function generateInvoiceNumber(orderNumber: string, date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const suffix = orderNumber.replace(/^ORD-/i, "");
	return `INV-${y}${m}${d}-${suffix}`;
}

/** Determine invoice status from payment + order status */
function resolveInvoiceStatus(
	paymentStatus: string,
	orderStatus: string,
): InvoiceData["status"] {
	if (orderStatus === "cancelled" || orderStatus === "refunded") return "void";
	if (paymentStatus === "paid") return "paid";
	if (paymentStatus === "refunded" || paymentStatus === "voided") return "void";
	return "issued";
}

/** Format a date for display on invoices */
function formatInvoiceDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date);
}

/** Auto-generate tracking URL from carrier name and tracking number */
const CARRIER_TRACKING_URLS: Record<string, (num: string) => string> = {
	ups: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
	usps: (n) =>
		`https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
	fedex: (n) =>
		`https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
	dhl: (n) =>
		`https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(n)}`,
};

function inferTrackingUrl(
	carrier: string | undefined,
	trackingNumber: string | undefined,
): string | undefined {
	if (!carrier || !trackingNumber) return undefined;
	const gen = CARRIER_TRACKING_URLS[carrier.toLowerCase()];
	return gen ? gen(trackingNumber) : undefined;
}

export function createOrderController(
	data: ModuleDataService,
	options?: { coreMoney?: ModuleContext["coreMoney"] },
): OrderController {
	const coreMoney = options?.coreMoney;
	async function recordAttribution(
		order: Order,
		input: {
			toCustomerId: string;
			reason: "legacy_subject_rewrite" | "guest_claim";
		},
	): Promise<Order | null> {
		if (order.customerId === input.toCustomerId) return order;
		const attributionId = `order-attr:${order.id}:${input.reason}:${input.toCustomerId}`;
		const existing = await data.get("orderCustomerAttribution", attributionId);
		const updated: Order = {
			...order,
			customerId: input.toCustomerId,
			updatedAt: new Date(),
		};
		await data.upsert("order", order.id, updated as Record<string, unknown>);
		if (!existing) {
			await data.upsert("orderCustomerAttribution", attributionId, {
				id: attributionId,
				orderId: order.id,
				fromCustomerId: order.customerId,
				toCustomerId: input.toCustomerId,
				reason: input.reason,
				createdAt: new Date(),
			});
		}
		return updated;
	}

	return {
		async create(params: CreateOrderParams): Promise<Order> {
			if (params.items.length === 0) {
				throw new Error("Order must contain at least one immutable line item.");
			}
			const moneyAmounts = [
				params.subtotal,
				params.taxAmount ?? 0,
				params.shippingAmount ?? 0,
				params.discountAmount ?? 0,
				params.giftCardAmount ?? 0,
				params.storeCreditAmount ?? 0,
				params.total,
				...params.items.map((item) => item.price),
			];
			if (
				moneyAmounts.some(
					(amount) => !Number.isSafeInteger(amount) || amount < 0,
				)
			) {
				throw new Error(
					"Order monetary values must be non-negative safe integers.",
				);
			}
			if (
				params.items.some(
					(item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1,
				)
			) {
				throw new Error(
					"Order item quantities must be positive safe integers.",
				);
			}
			const itemSubtotal = params.items.reduce((subtotal, item) => {
				const lineSubtotal = item.price * item.quantity;
				if (!Number.isSafeInteger(lineSubtotal)) {
					throw new Error("Order line subtotal exceeds safe integer bounds.");
				}
				return subtotal + lineSubtotal;
			}, 0);
			if (
				!Number.isSafeInteger(itemSubtotal) ||
				itemSubtotal !== params.subtotal
			) {
				throw new Error(
					"Order subtotal does not match its immutable line items.",
				);
			}
			const expectedTotal = Math.max(
				0,
				params.subtotal +
					(params.taxAmount ?? 0) +
					(params.shippingAmount ?? 0) -
					(params.discountAmount ?? 0) -
					(params.giftCardAmount ?? 0) -
					(params.storeCreditAmount ?? 0),
			);
			if (
				!Number.isSafeInteger(expectedTotal) ||
				expectedTotal !== params.total
			) {
				throw new Error(
					"Order total does not match its accepted amount components.",
				);
			}
			if (!/^[A-Z]{3}$/.test(params.currency ?? "USD")) {
				throw new Error("Order currency must be an uppercase ISO 4217 code.");
			}
			const id = params.id ?? crypto.randomUUID();

			// A caller that supplies an identifier owns it, so a repeat is a replay
			// rather than a second Order. Without this, retrying after a lost
			// response renumbers the Order the shopper was shown and writes a second
			// full set of line items and addresses against the same identifier.
			//
			// A replay must still finish the writes. The first attempt can fail
			// after the Order row commits but before its items and addresses do, so
			// returning here on the strength of the row alone would hand back an
			// Order that permanently lost its line truth. Every write below is keyed
			// deterministically, so repeating them converges instead of duplicating.
			const existing = params.id
				? ((await data.get("order", id)) as Order | null)
				: null;

			const orderNumber = existing?.orderNumber ?? generateOrderNumber();
			const now = new Date();

			const order: Order = {
				id,
				orderNumber,
				customerId: params.customerId,
				guestEmail: params.guestEmail,
				status: "pending",
				paymentStatus: params.paymentStatus ?? "unpaid",
				subtotal: params.subtotal,
				taxAmount: params.taxAmount ?? 0,
				shippingAmount: params.shippingAmount ?? 0,
				discountAmount: params.discountAmount ?? 0,
				giftCardAmount: params.giftCardAmount ?? 0,
				storeCreditAmount: params.storeCreditAmount ?? 0,
				total: params.total,
				currency: params.currency ?? "USD",
				checkoutId: params.checkoutId,
				acceptedOfferId: params.acceptedOfferId,
				catalogRevision: params.catalogRevision,
				priceSourceVersion: params.priceSourceVersion,
				taxQuoteId: params.taxQuoteId,
				shippingQuoteId: params.shippingQuoteId,
				shippingOptionId: params.shippingOptionId,
				inventoryReservationIds: params.inventoryReservationIds ?? [],
				paymentConnectionId: params.paymentConnectionId,
				paymentOperationId: params.paymentOperationId,
				notes: params.notes,
				metadata: params.metadata ?? {},
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
			};

			// Only write the Order row when it is absent. A replay may arrive after
			// the Order has legitimately advanced, and rewriting it from the original
			// request would roll a later status or Payment transition backwards.
			if (!existing) {
				await data.upsert("order", id, order as Record<string, unknown>);
			}

			// Create order items. Their identifiers derive from the Order and the
			// line position so a partial write that is retried overwrites the same
			// rows instead of adding a parallel set.
			for (const [index, item] of params.items.entries()) {
				const orderItem: OrderItem = {
					id: `${id}:item:${index}`,
					orderId: id,
					productId: item.productId,
					variantId: item.variantId,
					name: item.name,
					sku: item.sku,
					price: item.price,
					quantity: item.quantity,
					subtotal: item.price * item.quantity,
					metadata: {},
				};
				await data.upsert(
					"orderItem",
					orderItem.id,
					orderItem as unknown as Record<string, unknown>,
				);
			}

			// Create billing address
			if (params.billingAddress) {
				const addr: OrderAddress = {
					id: `${id}:address:billing`,
					orderId: id,
					type: "billing",
					...params.billingAddress,
				};
				await data.upsert(
					"orderAddress",
					addr.id,
					addr as Record<string, unknown>,
				);
			}

			// Create shipping address
			if (params.shippingAddress) {
				const addr: OrderAddress = {
					id: `${id}:address:shipping`,
					orderId: id,
					type: "shipping",
					...params.shippingAddress,
				};
				await data.upsert(
					"orderAddress",
					addr.id,
					addr as Record<string, unknown>,
				);
			}

			if (!existing && coreMoney) {
				const partyId =
					order.customerId &&
					/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
						order.customerId,
					)
						? order.customerId
						: id;
				await coreMoney.write({
					party: {
						id: partyId,
						kind: "person",
						email: order.guestEmail ?? null,
					},
					subject: {
						id,
						kind: "order",
						ownerModule: "orders",
						partyId,
						currency: order.currency,
						expectedMinor: order.total,
						settleState: "open",
					},
					transaction: {
						id,
						subjectId: id,
						authorizedMinor: order.total,
						capturedMinor: 0,
						refundedMinor: 0,
					},
				});
			}

			return existing ?? order;
		},

		async getById(id: string): Promise<OrderWithDetails | null> {
			const order = (await data.get("order", id)) as Order | null;
			if (!order) return null;

			const items = (await data.findMany("orderItem", {
				where: { orderId: id },
			})) as OrderItem[];

			const addresses = (await data.findMany("orderAddress", {
				where: { orderId: id },
			})) as OrderAddress[];

			return { ...order, items, addresses };
		},

		async getByOrderNumber(
			orderNumber: string,
		): Promise<OrderWithDetails | null> {
			const orders = (await data.findMany("order", {
				where: { orderNumber },
				take: 1,
			})) as Order[];

			const order = orders[0];
			if (!order) return null;

			return this.getById(order.id);
		},

		async listForCustomer(
			customerId: string,
			params?: { limit?: number; offset?: number },
		): Promise<{ orders: Order[]; total: number }> {
			const all = (await data.findMany("order", {
				where: { customerId },
			})) as Order[];

			all.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const limit = params?.limit ?? 20;
			const offset = params?.offset ?? 0;

			return {
				orders: all.slice(offset, offset + limit),
				total: all.length,
			};
		},

		async adoptLegacySubjectOrders(authSubject, storeCustomerId) {
			if (authSubject === storeCustomerId) return 0;
			const legacy = (await data.findMany("order", {
				where: { customerId: authSubject },
			})) as Order[];
			let adopted = 0;
			for (const order of legacy) {
				const result = await recordAttribution(order, {
					toCustomerId: storeCustomerId,
					reason: "legacy_subject_rewrite",
				});
				if (result) adopted += 1;
			}
			return adopted;
		},

		async claimGuestOrder(params) {
			const order = (await data.get("order", params.orderId)) as Order | null;
			if (!order) {
				return { ok: false as const, code: "order_not_found" as const };
			}
			if (order.customerId === params.storeCustomerId) {
				return { ok: true as const, order, claimed: false };
			}
			if (!order.guestEmail) {
				return { ok: false as const, code: "proof_invalid" as const };
			}
			if (!(await orderAcceptsGuestProof(order, params.proofs))) {
				return { ok: false as const, code: "proof_invalid" as const };
			}
			if (order.customerId) {
				return { ok: false as const, code: "proof_invalid" as const };
			}
			const claimed = await recordAttribution(order, {
				toCustomerId: params.storeCustomerId,
				reason: "guest_claim",
			});
			if (!claimed) {
				return { ok: false as const, code: "order_not_found" as const };
			}
			return { ok: true as const, order: claimed, claimed: true };
		},

		async guestProofMatches(order, proofs) {
			return orderAcceptsGuestProof(order, proofs);
		},

		async hasCustomerPurchasedProduct(
			customerId: string,
			productId: string,
		): Promise<boolean> {
			// Find all order items for this product, then check if any belong to the customer
			const items = (await data.findMany("orderItem", {
				where: { productId },
			})) as OrderItem[];

			if (items.length === 0) return false;

			const checkedOrderIds = new Set<string>();
			for (const item of items) {
				if (checkedOrderIds.has(item.orderId)) continue;
				checkedOrderIds.add(item.orderId);
				const order = (await data.get("order", item.orderId)) as Order | null;
				if (order?.customerId === customerId) return true;
			}

			return false;
		},

		async list(params): Promise<{ orders: Order[]; total: number }> {
			const { limit = 20, offset = 0, search, status, paymentStatus } = params;

			// Push status/paymentStatus filters to DB; text search stays client-side
			const where: Record<string, unknown> = {};
			if (status) where.status = status;
			if (paymentStatus) where.paymentStatus = paymentStatus;

			const all = (await data.findMany("order", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as Order[];

			const filtered = search
				? all.filter((o) => {
						const q = search.toLowerCase();
						return (
							o.orderNumber.toLowerCase().includes(q) ||
							(o.guestEmail?.toLowerCase().includes(q) ?? false) ||
							(o.customerId?.toLowerCase().includes(q) ?? false)
						);
					})
				: all;

			filtered.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return {
				orders: filtered.slice(offset, offset + limit),
				total: filtered.length,
			};
		},

		async listForExport(params): Promise<{
			orders: OrderWithDetails[];
			total: number;
		}> {
			const {
				limit = 500,
				offset = 0,
				search,
				status,
				paymentStatus,
				dateFrom,
				dateTo,
			} = params;

			const where: Record<string, unknown> = {};
			if (status) where.status = status;
			if (paymentStatus) where.paymentStatus = paymentStatus;

			const all = (await data.findMany("order", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as Order[];

			let filtered = search
				? all.filter((o) => {
						const q = search.toLowerCase();
						return (
							o.orderNumber.toLowerCase().includes(q) ||
							(o.guestEmail?.toLowerCase().includes(q) ?? false) ||
							(o.customerId?.toLowerCase().includes(q) ?? false)
						);
					})
				: all;

			if (dateFrom) {
				const from = dateFrom.getTime();
				filtered = filtered.filter(
					(o) => new Date(o.createdAt).getTime() >= from,
				);
			}
			if (dateTo) {
				const to = dateTo.getTime();
				filtered = filtered.filter(
					(o) => new Date(o.createdAt).getTime() <= to,
				);
			}

			filtered.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const paged = filtered.slice(offset, offset + limit);

			const ordersWithDetails: OrderWithDetails[] = [];
			for (const order of paged) {
				const items = (await data.findMany("orderItem", {
					where: { orderId: order.id },
				})) as OrderItem[];
				const addresses = (await data.findMany("orderAddress", {
					where: { orderId: order.id },
				})) as OrderAddress[];
				ordersWithDetails.push({ ...order, items, addresses });
			}

			return { orders: ordersWithDetails, total: filtered.length };
		},

		async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
			const existing = (await data.get("order", id)) as Order | null;
			if (!existing) return null;

			const updated: Order = { ...existing, status, updatedAt: new Date() };
			await data.upsert("order", id, updated as Record<string, unknown>);
			return updated;
		},

		async updatePaymentStatus(
			id: string,
			paymentStatus: PaymentStatus,
		): Promise<Order | null> {
			const existing = (await data.get("order", id)) as Order | null;
			if (!existing) return null;

			const updated: Order = {
				...existing,
				paymentStatus,
				updatedAt: new Date(),
			};
			await data.upsert("order", id, updated as Record<string, unknown>);
			return updated;
		},

		async update(
			id: string,
			params: { notes?: string; metadata?: Record<string, unknown> },
		): Promise<Order | null> {
			const existing = (await data.get("order", id)) as Order | null;
			if (!existing) return null;

			const updated: Order = {
				...existing,
				...(params.notes !== undefined ? { notes: params.notes } : {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("order", id, updated as Record<string, unknown>);
			return updated;
		},

		async cancel(id: string): Promise<Order | null> {
			const existing = (await data.get("order", id)) as Order | null;
			if (!existing) return null;

			if (!CANCELLABLE_STATUSES.includes(existing.status)) {
				return null; // Cannot cancel orders in terminal states
			}

			const updated: Order = {
				...existing,
				status: "cancelled",
				updatedAt: new Date(),
			};
			await data.upsert("order", id, updated as Record<string, unknown>);
			return updated;
		},

		async delete(id: string): Promise<void> {
			await data.delete("order", id);
		},

		async getItems(orderId: string): Promise<OrderItem[]> {
			return (await data.findMany("orderItem", {
				where: { orderId },
			})) as OrderItem[];
		},

		async getAddresses(orderId: string): Promise<OrderAddress[]> {
			return (await data.findMany("orderAddress", {
				where: { orderId },
			})) as OrderAddress[];
		},

		// ── Return Request Methods ────────────────────────────────────────

		async createReturn(params: CreateReturnParams): Promise<ReturnRequest> {
			const id = crypto.randomUUID();
			const now = new Date();

			const returnRequest: ReturnRequest = {
				id,
				orderId: params.orderId,
				status: "requested",
				type: params.type ?? "refund",
				reason: params.reason,
				customerNotes: params.customerNotes,
				adminNotes: undefined,
				refundAmount: undefined,
				trackingNumber: undefined,
				trackingUrl: undefined,
				carrier: undefined,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"returnRequest",
				id,
				returnRequest as Record<string, unknown>,
			);

			for (const item of params.items) {
				const returnItem: ReturnItem = {
					id: crypto.randomUUID(),
					returnRequestId: id,
					orderItemId: item.orderItemId,
					quantity: item.quantity,
					reason: item.reason,
				};
				await data.upsert(
					"returnItem",
					returnItem.id,
					returnItem as unknown as Record<string, unknown>,
				);
			}

			return returnRequest;
		},

		async getReturn(id: string): Promise<ReturnRequestWithItems | null> {
			const returnRequest = (await data.get(
				"returnRequest",
				id,
			)) as ReturnRequest | null;
			if (!returnRequest) return null;

			const items = (await data.findMany("returnItem", {
				where: { returnRequestId: id },
			})) as ReturnItem[];

			return { ...returnRequest, items };
		},

		async listReturns(orderId: string): Promise<ReturnRequestWithItems[]> {
			const returns = (await data.findMany("returnRequest", {
				where: { orderId },
			})) as ReturnRequest[];

			returns.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const result: ReturnRequestWithItems[] = [];
			for (const r of returns) {
				const items = (await data.findMany("returnItem", {
					where: { returnRequestId: r.id },
				})) as ReturnItem[];
				result.push({ ...r, items });
			}
			return result;
		},

		async listAllReturns(params): Promise<{
			returns: ReturnRequestWithItems[];
			total: number;
		}> {
			const { limit = 20, offset = 0, status } = params;

			const where: Record<string, unknown> = {};
			if (status) where.status = status;

			const all = (await data.findMany("returnRequest", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as ReturnRequest[];

			all.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const paged = all.slice(offset, offset + limit);
			const result: ReturnRequestWithItems[] = [];
			for (const r of paged) {
				const items = (await data.findMany("returnItem", {
					where: { returnRequestId: r.id },
				})) as ReturnItem[];
				result.push({ ...r, items });
			}

			return { returns: result, total: all.length };
		},

		async updateReturn(
			id: string,
			params: UpdateReturnParams,
		): Promise<ReturnRequest | null> {
			const existing = (await data.get(
				"returnRequest",
				id,
			)) as ReturnRequest | null;
			if (!existing) return null;

			const trackingUrl =
				params.trackingUrl ??
				(params.trackingNumber || params.carrier
					? inferTrackingUrl(
							params.carrier ?? existing.carrier,
							params.trackingNumber ?? existing.trackingNumber,
						)
					: existing.trackingUrl);

			const updated: ReturnRequest = {
				...existing,
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.adminNotes !== undefined
					? { adminNotes: params.adminNotes }
					: {}),
				...(params.refundAmount !== undefined
					? { refundAmount: params.refundAmount }
					: {}),
				...(params.trackingNumber !== undefined
					? { trackingNumber: params.trackingNumber }
					: {}),
				trackingUrl,
				...(params.carrier !== undefined ? { carrier: params.carrier } : {}),
				updatedAt: new Date(),
			};

			await data.upsert(
				"returnRequest",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async deleteReturn(id: string): Promise<void> {
			const items = (await data.findMany("returnItem", {
				where: { returnRequestId: id },
			})) as ReturnItem[];
			for (const item of items) {
				await data.delete("returnItem", item.id);
			}
			await data.delete("returnRequest", id);
		},

		// ── Bulk Operations ────────────────────────────────────────────────

		async bulkUpdateStatus(
			ids: string[],
			status: OrderStatus,
		): Promise<{ updated: number }> {
			if (!ids.length) return { updated: 0 };

			const now = new Date();
			let updated = 0;

			for (const id of ids) {
				const order = (await data.get("order", id)) as Order | null;
				if (order) {
					const updated_order = { ...order, status, updatedAt: now };
					await data.upsert(
						"order",
						id,
						updated_order as Record<string, unknown>,
					);
					updated++;
				}
			}

			return { updated };
		},

		async bulkUpdatePaymentStatus(
			ids: string[],
			paymentStatus: PaymentStatus,
		): Promise<{ updated: number }> {
			if (!ids.length) return { updated: 0 };

			const now = new Date();
			let updated = 0;

			for (const id of ids) {
				const order = (await data.get("order", id)) as Order | null;
				if (order) {
					const updated_order = { ...order, paymentStatus, updatedAt: now };
					await data.upsert(
						"order",
						id,
						updated_order as Record<string, unknown>,
					);
					updated++;
				}
			}

			return { updated };
		},

		async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
			if (!ids.length) return { deleted: 0 };

			let deleted = 0;

			for (const id of ids) {
				const order = (await data.get("order", id)) as Order | null;
				if (!order) continue;

				// Delete related records first
				const items = (await data.findMany("orderItem", {
					where: { orderId: id },
				})) as OrderItem[];
				for (const item of items) {
					await data.delete("orderItem", item.id);
				}

				const addresses = (await data.findMany("orderAddress", {
					where: { orderId: id },
				})) as OrderAddress[];
				for (const addr of addresses) {
					await data.delete("orderAddress", addr.id);
				}

				const returns = (await data.findMany("returnRequest", {
					where: { orderId: id },
				})) as ReturnRequest[];
				for (const r of returns) {
					const rItems = (await data.findMany("returnItem", {
						where: { returnRequestId: r.id },
					})) as ReturnItem[];
					for (const ri of rItems) {
						await data.delete("returnItem", ri.id);
					}
					await data.delete("returnRequest", r.id);
				}

				const notes = (await data.findMany("orderNote", {
					where: { orderId: id },
				})) as OrderNote[];
				for (const note of notes) {
					await data.delete("orderNote", note.id);
				}

				await data.delete("order", id);
				deleted++;
			}

			return { deleted };
		},

		// ── Order Notes ────────────────────────────────────────────────────

		async addNote(params: AddNoteParams): Promise<OrderNote> {
			const id = crypto.randomUUID();
			const now = new Date();

			const note: OrderNote = {
				id,
				orderId: params.orderId,
				type: params.type ?? "note",
				content: params.content,
				authorId: params.authorId,
				authorName: params.authorName,
				metadata: params.metadata ?? {},
				createdAt: now,
			};

			await data.upsert("orderNote", id, note as Record<string, unknown>);
			return note;
		},

		async listNotes(orderId: string): Promise<OrderNote[]> {
			const notes = (await data.findMany("orderNote", {
				where: { orderId },
			})) as OrderNote[];

			notes.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return notes;
		},

		async deleteNote(id: string): Promise<void> {
			await data.delete("orderNote", id);
		},

		// ── Invoice ────────────────────────────────────────────────────────

		// ── Customer Returns ──────────────────────────────────────────────

		async listReturnsForCustomer(
			customerId: string,
			params?: {
				limit?: number | undefined;
				offset?: number | undefined;
				status?: ReturnStatus | undefined;
			},
		): Promise<{
			returns: Array<ReturnRequestWithItems & { orderNumber: string }>;
			total: number;
		}> {
			const limit = params?.limit ?? 20;
			const offset = params?.offset ?? 0;

			// Get all customer orders
			const customerOrders = (await data.findMany("order", {
				where: { customerId },
			})) as Order[];

			if (customerOrders.length === 0) {
				return { returns: [], total: 0 };
			}

			// Build order lookup map
			const orderMap = new Map(customerOrders.map((o) => [o.id, o]));
			const orderIds = new Set(customerOrders.map((o) => o.id));

			// Get all return requests, then filter to customer's orders
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const allReturns = (await data.findMany("returnRequest", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as ReturnRequest[];

			const customerReturns = allReturns.filter((r) => orderIds.has(r.orderId));

			customerReturns.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const paged = customerReturns.slice(offset, offset + limit);

			const result: Array<ReturnRequestWithItems & { orderNumber: string }> =
				[];
			for (const r of paged) {
				const items = (await data.findMany("returnItem", {
					where: { returnRequestId: r.id },
				})) as ReturnItem[];
				const order = orderMap.get(r.orderId);
				result.push({
					...r,
					items,
					orderNumber: order?.orderNumber ?? "",
				});
			}

			return { returns: result, total: customerReturns.length };
		},

		// ── Public Order Tracking ──────────────────────────────────────────

		async getByTracking(
			orderNumber: string,
			email: string,
		): Promise<OrderWithDetails | null> {
			const order = await this.getByOrderNumber(orderNumber);
			if (!order) return null;

			const normalizedEmail = email.toLowerCase().trim();

			// Match against guestEmail
			if (order.guestEmail?.toLowerCase().trim() === normalizedEmail) {
				return order;
			}

			// Match against billing address name isn't enough — we need email.
			// Orders placed by a logged-in customer store customerId, not guestEmail.
			// For logged-in customers, metadata may hold the email.
			const meta = order.metadata as Record<string, unknown> | undefined;
			if (
				typeof meta?.customerEmail === "string" &&
				meta.customerEmail.toLowerCase().trim() === normalizedEmail
			) {
				return order;
			}

			return null;
		},

		async getInvoiceData(
			orderId: string,
			storeName: string,
		): Promise<InvoiceData | null> {
			const order = await this.getById(orderId);
			if (!order) return null;

			const billingAddr = order.addresses.find((a) => a.type === "billing");
			const shippingAddr = order.addresses.find((a) => a.type === "shipping");

			const stripAddrMeta = (
				addr: OrderAddress | undefined,
			): Omit<OrderAddress, "id" | "orderId" | "type"> | undefined => {
				if (!addr) return undefined;
				const { id: _id, orderId: _oid, type: _t, ...rest } = addr;
				return rest;
			};

			const issueDate = new Date(order.createdAt);
			const dueDate =
				order.paymentStatus === "paid"
					? issueDate
					: new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

			const customerName = billingAddr
				? `${billingAddr.firstName} ${billingAddr.lastName}`
				: "Customer";

			return {
				invoiceNumber: generateInvoiceNumber(order.orderNumber, issueDate),
				orderNumber: order.orderNumber,
				orderId: order.id,
				issueDate: formatInvoiceDate(issueDate),
				dueDate: formatInvoiceDate(dueDate),
				status: resolveInvoiceStatus(order.paymentStatus, order.status),
				customerName,
				customerEmail: order.guestEmail,
				billingAddress: stripAddrMeta(billingAddr),
				shippingAddress: stripAddrMeta(shippingAddr),
				lineItems: order.items.map((item) => ({
					name: item.name,
					sku: item.sku,
					quantity: item.quantity,
					unitPrice: item.price,
					subtotal: item.subtotal,
				})),
				subtotal: order.subtotal,
				taxAmount: order.taxAmount,
				shippingAmount: order.shippingAmount,
				discountAmount: order.discountAmount,
				giftCardAmount: order.giftCardAmount,
				storeCreditAmount: order.storeCreditAmount ?? 0,
				total: order.total,
				currency: order.currency,
				storeName,
				notes: order.notes,
			};
		},

		// ── Reorder ──────────────────────────────────────────────────────────

		async getReorderItems(orderId: string): Promise<ReorderItem[] | null> {
			const order = (await data.get("order", orderId)) as Order | null;
			if (!order) return null;

			const items = (await data.findMany("orderItem", {
				where: { orderId },
			})) as OrderItem[];

			return items.map((item) => ({
				productId: item.productId,
				variantId: item.variantId,
				name: item.name,
				sku: item.sku,
				price: item.price,
				quantity: item.quantity,
			}));
		},
	};
}
