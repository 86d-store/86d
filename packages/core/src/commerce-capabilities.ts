import { z } from "zod";
import { defineCapability } from "./capabilities";

/**
 * Pure, versioned commerce contracts shared by capability owners and consumers.
 * Business logic and data access remain in the owning Modules.
 */

export const abandonedCartRecoveryResolveCapability = defineCapability({
	name: "abandoned-carts.recovery.resolve",
	version: "1.0.0",
	owner: "abandoned-carts",
	request: z.object({ cartId: z.string().min(1).max(200) }).strict(),
	decision: z
		.object({
			items: z.array(
				z
					.object({
						name: z.string(),
						quantity: z.number().int().positive(),
						price: z.number().nonnegative(),
						imageUrl: z.string().optional(),
					})
					.strict(),
			),
			cartTotal: z.number().nonnegative(),
			currency: z.string().length(3),
			recoveryToken: z.string(),
		})
		.strict(),
	failure: z
		.object({ code: z.enum(["cart_not_found", "lookup_failed"]) })
		.strict(),
});

export const cartSnapshotCapability = defineCapability({
	name: "cart.snapshot",
	version: "1.0.0",
	owner: "cart",
	request: z
		.object({
			cartId: z.string().min(1).max(200),
			customerId: z.string().min(1).max(200).optional(),
			guestId: z.string().min(1).max(200).optional(),
		})
		.strict()
		.refine(
			(request) =>
				(request.customerId === undefined) !== (request.guestId === undefined),
			"Exactly one Cart owner identity is required.",
		),
	decision: z
		.object({
			cartId: z.string().min(1).max(200),
			revision: z.string().datetime(),
			items: z
				.array(
					z
						.object({
							productId: z.string().min(1).max(200),
							variantId: z.string().min(1).max(200).optional(),
							quantity: z.number().int().positive().max(999),
						})
						.strict(),
				)
				.max(100),
		})
		.strict(),
	failure: z
		.object({
			code: z.enum(["CART_NOT_FOUND", "CART_NOT_ACTIVE", "CART_NOT_OWNED"]),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

export const customerContactResolveCapability = defineCapability({
	name: "customers.contact.resolve",
	version: "1.0.0",
	owner: "customers",
	request: z.object({ customerId: z.string().min(1).max(200) }).strict(),
	decision: z
		.object({
			email: z.string().email(),
			firstName: z.string(),
			lastName: z.string(),
			phone: z.string().optional(),
		})
		.strict(),
	failure: z
		.object({ code: z.enum(["customer_not_found", "lookup_failed"]) })
		.strict(),
});

/**
 * Resolve a server-verified authentication principal to a Store-owned Customer.
 * The raw authentication subject is input identity, never the Customer ID.
 */
export const customerIdentityResolveCapability = defineCapability({
	name: "customers.identity.resolve",
	version: "1.0.0",
	owner: "customers",
	request: z
		.object({
			identity: z
				.object({
					provider: z.string().trim().min(1).max(100),
					subject: z.string().trim().min(1).max(255),
					email: z.string().email().max(320),
					emailVerified: z.boolean(),
					firstName: z.string().max(200).optional(),
					lastName: z.string().max(200).optional(),
				})
				.strict(),
			audit: z
				.object({
					source: z.enum(["storefront", "store_admin", "workload", "system"]),
					correlationId: z.string().min(1).max(255),
				})
				.strict(),
		})
		.strict(),
	decision: z
		.object({
			customerId: z.string().min(1).max(100),
			bindingId: z.string().min(1).max(100),
			verifiedEmail: z.string().email().max(320),
			createdCustomer: z.boolean(),
			createdBinding: z.boolean(),
			boundAt: z.string().datetime(),
		})
		.strict(),
	failure: z
		.object({
			code: z.enum([
				"INVALID_IDENTITY_INPUT",
				"AUTH_IDENTITY_UNVERIFIED",
				"TRANSACTION_UNAVAILABLE",
				"LOCKING_UNAVAILABLE",
				"AUTH_IDENTITY_CONFLICT",
				"CUSTOMER_STATE_INVALID",
			]),
			message: z.string().min(1).max(300),
		})
		.strict(),
});

/** Resolve shopper-visible presentation from the Store Runtime Settings owner. */
export const storePresentationResolveCapability = defineCapability({
	name: "settings.presentation.resolve",
	version: "1.0.0",
	owner: "settings",
	request: z.object({}).strict(),
	decision: z
		.object({
			storeName: z.string().min(1).max(200),
			storeDescription: z.string().max(2_000).optional(),
			supportEmail: z.string().email().max(320).optional(),
			currency: z
				.string()
				.regex(/^[A-Z]{3}$/)
				.optional(),
		})
		.strict(),
	failure: z
		.object({
			code: z.enum(["SETTINGS_UNAVAILABLE", "SETTINGS_INVALID"]),
			message: z.string().min(1).max(300),
		})
		.strict(),
});

export const discountCodeCapability = defineCapability({
	name: "discounts.code",
	version: "1.0.0",
	owner: "discounts",
	request: z
		.object({
			operation: z.enum(["validate", "commit"]),
			code: z.string().min(1).max(50),
			subtotal: z.number().int().nonnegative(),
			productIds: z.array(z.string().min(1).max(200)).max(100).optional(),
			categoryIds: z.array(z.string().min(1).max(200)).max(100).optional(),
		})
		.strict(),
	decision: z
		.object({
			valid: z.boolean(),
			discountAmount: z.number().int().nonnegative(),
			freeShipping: z.boolean(),
			error: z.string().max(200).optional(),
		})
		.strict(),
	failure: z
		.object({
			code: z.literal("DISCOUNT_PROVIDER_FAILED"),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

export const giftCardCheckoutCapability = defineCapability({
	name: "gift-cards.checkout",
	version: "1.0.0",
	owner: "gift-cards",
	request: z.discriminatedUnion("operation", [
		z
			.object({
				operation: z.literal("balance"),
				code: z.string().min(1).max(50),
			})
			.strict(),
		z
			.object({
				operation: z.literal("redeem"),
				code: z.string().min(1).max(50),
				amount: z.number().int().positive(),
				orderId: z.string().min(1).max(200).optional(),
			})
			.strict(),
	]),
	decision: z.discriminatedUnion("operation", [
		z
			.object({
				operation: z.literal("balance"),
				balance: z.number().int().nonnegative(),
				currency: z.string().length(3),
				status: z.string().min(1).max(50),
			})
			.strict(),
		z
			.object({
				operation: z.literal("redeem"),
				transactionId: z.string(),
				amount: z.number().int().positive(),
				balanceAfter: z.number().int().nonnegative(),
			})
			.strict(),
	]),
	failure: z
		.object({
			code: z.enum(["GIFT_CARD_NOT_FOUND", "GIFT_CARD_REDEMPTION_FAILED"]),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

const inventoryItemRequestSchema = z.object({
	productId: z.string().min(1).max(200),
	variantId: z.string().min(1).max(200).optional(),
	locationId: z.string().min(1).max(200).optional(),
	quantity: z.number().int().positive().max(1_000_000),
});

export const inventoryCheckoutCapability = defineCapability({
	name: "inventory.checkout",
	version: "1.0.0",
	owner: "inventory",
	request: z.discriminatedUnion("operation", [
		inventoryItemRequestSchema
			.extend({ operation: z.literal("check") })
			.strict(),
		inventoryItemRequestSchema
			.extend({ operation: z.literal("reserve") })
			.strict(),
		inventoryItemRequestSchema
			.extend({ operation: z.literal("release") })
			.strict(),
		inventoryItemRequestSchema
			.extend({ operation: z.literal("deduct") })
			.strict(),
		z
			.object({
				operation: z.literal("set"),
				productId: z.string().min(1).max(200),
				variantId: z.string().min(1).max(200).optional(),
				locationId: z.string().min(1).max(200).optional(),
				quantity: z.number().int().nonnegative().max(1_000_000),
				lowStockThreshold: z.number().int().nonnegative().optional(),
				allowBackorder: z.boolean().optional(),
				productName: z.string().max(500).optional(),
				variantName: z.string().max(500).optional(),
			})
			.strict(),
		z
			.object({
				operation: z.literal("adjust"),
				productId: z.string().min(1).max(200),
				variantId: z.string().min(1).max(200).optional(),
				locationId: z.string().min(1).max(200).optional(),
				delta: z.number().int().min(-1_000_000).max(1_000_000),
			})
			.strict(),
	]),
	decision: z
		.object({
			operation: z.enum([
				"check",
				"reserve",
				"release",
				"deduct",
				"set",
				"adjust",
			]),
			available: z.boolean().optional(),
			stock: z
				.object({
					quantity: z.number().int().nonnegative(),
					reserved: z.number().int().nonnegative(),
					available: z.number().int().nonnegative(),
				})
				.strict()
				.optional(),
		})
		.strict(),
	failure: z
		.object({
			code: z.enum(["INSUFFICIENT_STOCK", "INVENTORY_ITEM_NOT_FOUND"]),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

export const productPriceConversionCapability = defineCapability({
	name: "multi-currency.product-price",
	version: "1.0.0",
	owner: "multi-currency",
	request: z
		.object({
			productId: z.string().min(1).max(200),
			basePriceInCents: z.number().int().nonnegative(),
			currencyCode: z.string().length(3),
		})
		.strict(),
	decision: z.object({ amount: z.number().int().nonnegative() }).strict(),
	failure: z
		.object({
			code: z.literal("CURRENCY_UNAVAILABLE"),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

export const notificationCreateCapability = defineCapability({
	name: "notifications.create",
	version: "1.0.0",
	owner: "notifications",
	request: z
		.object({
			customerId: z.string().min(1).max(200),
			title: z.string().min(1).max(500),
			body: z.string().min(1).max(10_000),
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		})
		.strict(),
	decision: z.object({ notificationId: z.string() }).strict(),
	failure: z.object({ code: z.literal("create_failed") }).strict(),
});

const orderAddressSchema = z
	.object({
		firstName: z.string().max(200),
		lastName: z.string().max(200),
		company: z.string().max(300).optional(),
		line1: z.string().max(500),
		line2: z.string().max(500).optional(),
		city: z.string().max(200),
		state: z.string().max(200),
		postalCode: z.string().max(50),
		country: z.string().min(2).max(2),
		phone: z.string().max(100).optional(),
	})
	.strict();

export const orderCreateCapability = defineCapability({
	name: "orders.create",
	version: "1.0.0",
	owner: "orders",
	request: z
		.object({
			id: z.string().min(1).max(200).optional(),
			customerId: z.string().min(1).max(200).optional(),
			guestEmail: z.string().email().max(320).optional(),
			currency: z
				.string()
				.regex(/^[A-Z]{3}$/)
				.optional(),
			paymentStatus: z
				.enum(["unpaid", "paid", "partially_paid", "refunded", "voided"])
				.optional(),
			subtotal: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
			taxAmount: z
				.number()
				.int()
				.nonnegative()
				.max(Number.MAX_SAFE_INTEGER)
				.optional(),
			shippingAmount: z
				.number()
				.int()
				.nonnegative()
				.max(Number.MAX_SAFE_INTEGER)
				.optional(),
			discountAmount: z
				.number()
				.int()
				.nonnegative()
				.max(Number.MAX_SAFE_INTEGER)
				.optional(),
			giftCardAmount: z
				.number()
				.int()
				.nonnegative()
				.max(Number.MAX_SAFE_INTEGER)
				.optional(),
			storeCreditAmount: z
				.number()
				.int()
				.nonnegative()
				.max(Number.MAX_SAFE_INTEGER)
				.optional(),
			total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
			notes: z.string().max(5000).optional(),
			metadata: z.record(z.string(), z.unknown()).optional(),
			items: z
				.array(
					z
						.object({
							productId: z.string().min(1).max(200),
							variantId: z.string().min(1).max(200).optional(),
							name: z.string().min(1).max(500),
							sku: z.string().max(200).optional(),
							price: z
								.number()
								.int()
								.nonnegative()
								.max(Number.MAX_SAFE_INTEGER),
							quantity: z.number().int().positive().max(9999),
						})
						.strict(),
				)
				.min(1)
				.max(1000),
			billingAddress: orderAddressSchema.optional(),
			shippingAddress: orderAddressSchema.optional(),
			// The decisions this Order was created from. Orders already stores and
			// accepts every one of these, but the capability could not carry them,
			// so a cross-module caller had no way to record what it agreed to. They
			// are the identities a Checkout Finalization holds, and without them a
			// created Order cannot be traced back to the offer, prices, tax quote,
			// Shipping quote, reservations, or Payment that produced it.
			checkoutId: z.string().min(1).max(200).optional(),
			acceptedOfferId: z.string().min(1).max(200).optional(),
			catalogRevision: z.string().min(1).max(200).optional(),
			priceSourceVersion: z.string().min(1).max(200).optional(),
			taxQuoteId: z.string().min(1).max(200).optional(),
			shippingQuoteId: z.string().min(1).max(200).optional(),
			shippingOptionId: z.string().min(1).max(200).optional(),
			inventoryReservationIds: z
				.array(z.string().min(1).max(200))
				.max(1000)
				.optional(),
			paymentConnectionId: z.string().min(1).max(200).optional(),
			paymentOperationId: z.string().min(1).max(200).optional(),
		})
		.strict(),
	decision: z.object({ orderId: z.string(), orderNumber: z.string() }).strict(),
	failure: z.object({ code: z.literal("create_failed") }).strict(),
});

export const orderCustomerAuthorizeCapability = defineCapability({
	name: "orders.customer.authorize",
	version: "1.0.0",
	owner: "orders",
	request: z
		.object({
			orderId: z.string().min(1).max(200),
			customerId: z.string().min(1).max(200),
		})
		.strict(),
	decision: z.object({ authorized: z.literal(true) }).strict(),
	failure: z
		.object({
			code: z.enum(["order_not_found", "not_owner", "lookup_failed"]),
		})
		.strict(),
});

export const orderGuestProofAuthorizeCapability = defineCapability({
	name: "orders.guest.authorize",
	version: "1.0.0",
	owner: "orders",
	request: z
		.object({
			orderId: z.string().min(1).max(200),
			proofs: z.array(z.string().min(16).max(200)).max(8),
		})
		.strict(),
	decision: z.object({ authorized: z.literal(true) }).strict(),
	failure: z
		.object({
			code: z.enum(["order_not_found", "proof_invalid", "lookup_failed"]),
		})
		.strict(),
});

/**
 * Orders validates immutable commercial line quantities for delivery owners.
 * Consumers receive only the bounded quantities they asked to allocate; the
 * capability does not expose Orders storage or grant mutation authority.
 */
export const orderLineQuantityValidateCapability = defineCapability({
	name: "orders.line-quantities.validate",
	version: "1.0.0",
	owner: "orders",
	request: z
		.object({
			orderId: z.string().min(1).max(200),
			items: z
				.array(
					z
						.object({
							orderItemId: z.string().min(1).max(200),
							quantity: z.number().int().positive().max(1_000_000),
						})
						.strict(),
				)
				.min(1)
				.max(1_000),
		})
		.strict(),
	decision: z
		.object({
			orderId: z.string().min(1).max(200),
			items: z
				.array(
					z
						.object({
							orderItemId: z.string().min(1).max(200),
							requestedQuantity: z.number().int().positive().max(1_000_000),
							orderedQuantity: z.number().int().positive().max(1_000_000),
						})
						.strict(),
				)
				.min(1)
				.max(1_000),
		})
		.strict(),
	failure: z
		.object({
			code: z.enum([
				"ORDER_NOT_FOUND",
				"ORDER_NOT_FULFILLABLE",
				"ORDER_LINE_NOT_FOUND",
				"ORDER_LINE_QUANTITY_EXCEEDED",
				"ORDER_LINE_DATA_INVALID",
				"ORDER_LOOKUP_FAILED",
			]),
		})
		.strict(),
});

export const orderPurchaseVerifyCapability = defineCapability({
	name: "orders.purchase.verify",
	version: "1.0.0",
	owner: "orders",
	request: z
		.object({
			customerId: z.string().min(1).max(200),
			productId: z.string().min(1).max(200),
		})
		.strict(),
	decision: z.object({ verified: z.boolean() }).strict(),
	failure: z.object({ code: z.literal("lookup_failed") }).strict(),
});

const paymentIntentDecisionSchema = z.object({
	id: z.string(),
	status: z.enum([
		"pending",
		"processing",
		"succeeded",
		"failed",
		"cancelled",
		"refunded",
	]),
	amount: z.number().int().positive(),
	currency: z.string().length(3),
	clientAction: z
		.discriminatedUnion("type", [
			z
				.object({
					type: z.literal("client_secret"),
					clientSecret: z.string().min(1).max(4096),
				})
				.strict(),
			z
				.object({
					type: z.literal("paypal_approval"),
					orderId: z.string().min(1).max(500),
				})
				.strict(),
			z
				.object({
					type: z.literal("braintree_tokenize"),
					clientToken: z.string().min(1).max(4096),
				})
				.strict(),
			z.object({ type: z.literal("square_tokenize") }).strict(),
		])
		.optional(),
});

export const paymentCheckoutCapability = defineCapability({
	name: "payments.checkout",
	version: "1.0.0",
	owner: "payments",
	request: z.discriminatedUnion("operation", [
		z
			.object({
				operation: z.literal("create"),
				amount: z.number().int().positive(),
				currency: z.string().length(3),
				customerId: z.string().min(1).max(200).optional(),
				email: z.string().email().max(320).optional(),
				checkoutSessionId: z.string().min(1).max(200),
				metadata: z.record(z.string().max(100), z.unknown()).optional(),
			})
			.strict(),
		z
			.object({
				operation: z.literal("get"),
				intentId: z.string().min(1).max(200),
			})
			.strict(),
		z
			.object({
				operation: z.literal("confirm"),
				intentId: z.string().min(1).max(200),
			})
			.strict(),
		z
			.object({
				operation: z.literal("cancel"),
				intentId: z.string().min(1).max(200),
			})
			.strict(),
	]),
	decision: paymentIntentDecisionSchema
		.extend({ operation: z.enum(["create", "get", "confirm", "cancel"]) })
		.strict(),
	failure: z
		.object({
			code: z.enum(["PAYMENT_NOT_FOUND", "PAYMENT_OPERATION_FAILED"]),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

const paymentIntentSchema = z
	.object({
		id: z.string(),
		providerIntentId: z.string().optional(),
		customerId: z.string().optional(),
		email: z.string().email().optional(),
		amount: z.number().int().positive(),
		currency: z.string().length(3),
		status: z.enum([
			"pending",
			"processing",
			"succeeded",
			"failed",
			"cancelled",
			"refunded",
		]),
		orderId: z.string().optional(),
		createdAt: z.date(),
		updatedAt: z.date(),
	})
	.strict();

export const paymentIntentCapability = defineCapability({
	name: "payments.intent",
	version: "1.0.0",
	owner: "payments",
	request: z.discriminatedUnion("operation", [
		z
			.object({
				operation: z.literal("get"),
				intentId: z.string().min(1).max(200),
			})
			.strict(),
		z
			.object({
				operation: z.literal("list"),
				customerId: z.string().min(1).max(200).optional(),
				status: z
					.enum([
						"pending",
						"processing",
						"succeeded",
						"failed",
						"cancelled",
						"refunded",
					])
					.optional(),
				orderId: z.string().min(1).max(200).optional(),
				take: z.number().int().positive().max(10_000).optional(),
				skip: z.number().int().nonnegative().optional(),
			})
			.strict(),
		z
			.object({
				operation: z.literal("refund"),
				intentId: z.string().min(1).max(200),
				amount: z.number().int().positive().optional(),
				reason: z.string().max(500).optional(),
			})
			.strict(),
	]),
	decision: z.discriminatedUnion("operation", [
		z
			.object({ operation: z.literal("get"), intent: paymentIntentSchema })
			.strict(),
		z
			.object({
				operation: z.literal("list"),
				intents: z.array(paymentIntentSchema),
			})
			.strict(),
		z
			.object({
				operation: z.literal("refund"),
				refund: z
					.object({
						id: z.string(),
						amount: z.number().int().positive(),
						status: z.enum(["pending", "succeeded", "failed"]),
					})
					.strict(),
			})
			.strict(),
	]),
	failure: z
		.object({
			code: z.enum(["PAYMENT_NOT_FOUND", "PAYMENT_OPERATION_FAILED"]),
		})
		.strict(),
});

export const priceListResolveCapability = defineCapability({
	name: "price-lists.resolve",
	version: "1.0.0",
	owner: "price-lists",
	request: z
		.object({
			productIds: z.array(z.string().min(1).max(200)).min(1).max(100),
			customerGroupId: z.string().min(1).max(200).optional(),
			quantity: z.number().int().positive().max(1_000_000).optional(),
			currency: z.string().length(3).optional(),
		})
		.strict(),
	decision: z
		.object({
			prices: z.record(
				z.string().max(200),
				z
					.object({
						price: z.number().int().nonnegative(),
						compareAtPrice: z.number().int().nonnegative().nullable(),
					})
					.strict(),
			),
		})
		.strict(),
	failure: z
		.object({
			code: z.literal("PRICE_LIST_RESOLUTION_FAILED"),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

export const productResolveCapability = defineCapability({
	name: "catalog.product.resolve",
	version: "1.0.0",
	owner: "products",
	request: z
		.object({
			productId: z.string().min(1).max(200),
			variantId: z.string().min(1).max(200).optional(),
		})
		.strict(),
	decision: z
		.object({
			product: z
				.object({
					id: z.string(),
					name: z.string(),
					slug: z.string(),
					status: z.literal("active"),
					price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
					sku: z.string().optional(),
					images: z.array(z.string()),
				})
				.strict(),
			variant: z
				.object({
					id: z.string(),
					productId: z.string(),
					name: z.string(),
					price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
					sku: z.string().optional(),
					images: z.array(z.string()),
				})
				.strict()
				.optional(),
		})
		.strict(),
	failure: z
		.object({
			code: z.enum([
				"not_found",
				"not_active",
				"invalid_price",
				"variant_not_found",
				"variant_mismatch",
			]),
		})
		.strict(),
});

export const shippingQuoteCapability = defineCapability({
	name: "shipping.quote",
	version: "1.0.0",
	owner: "shipping",
	request: z
		.object({
			country: z.string().length(2),
			orderAmount: z.number().int().nonnegative(),
			weight: z.number().nonnegative().optional(),
		})
		.strict(),
	decision: z
		.object({
			rates: z
				.array(
					z
						.object({
							id: z.string(),
							name: z.string(),
							zoneName: z.string(),
							price: z.number().int().nonnegative(),
						})
						.strict(),
				)
				.min(1)
				.max(100),
		})
		.strict(),
	failure: z
		.object({
			code: z.literal("NO_SHIPPING_OPTION"),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

export const storeCreditCheckoutCapability = defineCapability({
	name: "store-credits.checkout",
	version: "1.0.0",
	owner: "store-credits",
	request: z.discriminatedUnion("operation", [
		z
			.object({
				operation: z.literal("balance"),
				customerId: z.string().min(1).max(200),
			})
			.strict(),
		z
			.object({
				operation: z.literal("debit"),
				customerId: z.string().min(1).max(200),
				amount: z.number().int().positive(),
				description: z.string().min(1).max(500),
				referenceType: z.string().min(1).max(100).optional(),
				referenceId: z.string().min(1).max(200).optional(),
			})
			.strict(),
	]),
	decision: z.discriminatedUnion("operation", [
		z
			.object({
				operation: z.literal("balance"),
				balance: z.number().int().nonnegative(),
			})
			.strict(),
		z
			.object({
				operation: z.literal("debit"),
				transactionId: z.string(),
				amount: z.number().int().positive(),
				balanceAfter: z.number().int().nonnegative(),
			})
			.strict(),
	]),
	failure: z
		.object({
			code: z.literal("STORE_CREDIT_DEBIT_FAILED"),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

export const taxQuoteCapability = defineCapability({
	name: "tax.quote",
	version: "1.0.0",
	owner: "tax",
	request: z
		.object({
			address: z
				.object({
					country: z.string().length(2),
					state: z.string().min(1).max(100),
					city: z.string().max(200).optional(),
					postalCode: z.string().max(20).optional(),
				})
				.strict(),
			lineItems: z
				.array(
					z
						.object({
							productId: z.string().min(1).max(200),
							categoryId: z.string().min(1).max(200).optional(),
							amount: z.number().int().nonnegative(),
							quantity: z.number().int().positive().max(1_000_000),
						})
						.strict(),
				)
				.min(1)
				.max(100),
			shippingAmount: z.number().int().nonnegative().optional(),
			customerId: z.string().min(1).max(200).optional(),
		})
		.strict(),
	decision: z
		.object({
			totalTax: z.number().int().nonnegative(),
			shippingTax: z.number().int().nonnegative(),
			lineItems: z
				.array(
					z
						.object({
							productId: z.string(),
							taxableAmount: z.number().nonnegative(),
							taxAmount: z.number().nonnegative(),
							rate: z.number().nonnegative(),
						})
						.strict(),
				)
				.max(100),
		})
		.strict(),
	failure: z
		.object({
			code: z.literal("TAX_REVIEW_REQUIRED"),
			message: z.string().min(1).max(200),
		})
		.strict(),
});

const taxMoneyMinorSchema = z
	.number()
	.int()
	.nonnegative()
	.max(Number.MAX_SAFE_INTEGER);

const taxQuoteV2LineSchema = z
	.object({
		lineId: z.string().min(1).max(200),
		productId: z.string().min(1).max(200),
		variantId: z.string().min(1).max(200).optional(),
		taxCategoryId: z.string().min(1).max(200),
		quantity: z.number().int().positive().max(1_000_000),
		unitAmount: taxMoneyMinorSchema,
		discountAmount: taxMoneyMinorSchema.optional(),
	})
	.strict()
	.superRefine((line, context) => {
		const grossAmount = line.unitAmount * line.quantity;
		if (!Number.isSafeInteger(grossAmount)) {
			context.addIssue({
				code: "custom",
				message: "Line total exceeds safe integer minor units",
				path: ["unitAmount"],
			});
		}
		if ((line.discountAmount ?? 0) > grossAmount) {
			context.addIssue({
				code: "custom",
				message: "Line discount cannot exceed the line total",
				path: ["discountAmount"],
			});
		}
	});

const taxQuoteV2AllocationSchema = z
	.object({
		lineId: z.string().min(1).max(200),
		productId: z.string().min(1).max(200),
		variantId: z.string().min(1).max(200).optional(),
		taxCategoryId: z.string().min(1).max(200),
		quantity: z.number().int().positive().max(1_000_000),
		grossAmount: taxMoneyMinorSchema,
		discountAmount: taxMoneyMinorSchema,
		taxableAmount: taxMoneyMinorSchema,
		taxAmount: taxMoneyMinorSchema.nullable(),
	})
	.strict();

export const taxQuoteV2Capability = defineCapability({
	name: "tax.quote",
	version: "2.0.0",
	owner: "tax",
	request: z
		.object({
			currency: z.string().regex(/^[A-Z]{3}$/),
			address: z
				.object({
					country: z.string().regex(/^[A-Z]{2}$/),
					state: z.string().min(1).max(100),
					city: z.string().min(1).max(200).optional(),
					postalCode: z.string().min(1).max(20).optional(),
					normalizationVersion: z.string().min(1).max(100),
				})
				.strict(),
			lineItems: z
				.array(taxQuoteV2LineSchema)
				.min(1)
				.max(100)
				.superRefine((lines, context) => {
					const lineIds = new Set<string>();
					for (const [index, line] of lines.entries()) {
						if (lineIds.has(line.lineId)) {
							context.addIssue({
								code: "custom",
								message: "Tax quote line IDs must be unique",
								path: [index, "lineId"],
							});
						}
						lineIds.add(line.lineId);
					}
				}),
			shippingAmount: taxMoneyMinorSchema.optional(),
			customerId: z.string().min(1).max(200).optional(),
			marketplaceStatus: z.enum(["NOT_MARKETPLACE", "COLLECTED", "UNKNOWN"]),
		})
		.strict()
		.superRefine((request, context) => {
			const subtotal = request.lineItems.reduce(
				(total, line) => total + line.unitAmount * line.quantity,
				0,
			);
			const discount = request.lineItems.reduce(
				(total, line) => total + (line.discountAmount ?? 0),
				0,
			);
			if (
				!Number.isSafeInteger(subtotal) ||
				!Number.isSafeInteger(discount) ||
				!Number.isSafeInteger(
					subtotal - discount + (request.shippingAmount ?? 0),
				)
			) {
				context.addIssue({
					code: "custom",
					message: "Tax quote totals exceed safe integer minor units",
					path: ["lineItems"],
				});
			}
		}),
	decision: z
		.object({
			quoteId: z.string().min(1).max(200),
			jurisdictionDecision: z.enum([
				"COLLECT",
				"NO_NEXUS",
				"MARKETPLACE_COLLECTED",
				"BLOCKED",
			]),
			status: z.enum([
				"CALCULATED",
				"NO_NEXUS",
				"EXEMPT",
				"MARKETPLACE_COLLECTED",
				"REVIEW_REQUIRED",
			]),
			reason: z.enum([
				"TAX_CALCULATED",
				"NO_NEXUS_POLICY",
				"EXEMPTION_APPLIED",
				"MARKETPLACE_POLICY",
				"POLICY_BLOCKED",
				"POLICY_NOT_CONFIGURED",
				"POLICY_INVALID",
				"POLICY_AMBIGUOUS",
				"UNSUPPORTED_JURISDICTION",
				"RATE_PACK_NOT_CONFIGURED",
				"RATE_PACK_INVALID",
				"RATE_PACK_STALE",
				"RATE_NOT_CONFIGURED",
				"RATE_AMBIGUOUS",
				"EXEMPTION_INVALID",
				"EXEMPTION_UNSUPPORTED",
				"MARKETPLACE_STATUS_UNRESOLVED",
				"MARKETPLACE_POLICY_CONFLICT",
				"PROVIDER_NOT_CONFIGURED",
				"PROVIDER_FAILED",
				"PROVIDER_RESPONSE_INVALID",
				"PROVIDER_NEXUS_CONFLICT",
				"UNSUPPORTED_CURRENCY",
				"MONEY_OVERFLOW",
				"QUOTE_PERSISTENCE_FAILED",
				"TAX_DATA_UNAVAILABLE",
			]),
			policyVersion: z.string().min(1).max(200),
			sourceVersion: z.string().min(1).max(200),
			issuedAt: z.string().datetime({ offset: true }),
			expiresAt: z.string().datetime({ offset: true }),
			currency: z.string().regex(/^[A-Z]{3}$/),
			source: z
				.object({
					kind: z.enum([
						"MANUAL",
						"OFFICIAL_DATA",
						"PROVIDER",
						"POLICY",
						"EXEMPTION",
					]),
					name: z.string().min(1).max(300),
					reference: z.string().min(1).max(1_000),
					connectionId: z.string().min(1).max(200).optional(),
				})
				.strict()
				.optional(),
			totals: z
				.object({
					subtotal: taxMoneyMinorSchema,
					discount: taxMoneyMinorSchema,
					shipping: taxMoneyMinorSchema,
					taxable: taxMoneyMinorSchema,
					lineTax: taxMoneyMinorSchema.nullable(),
					shippingTax: taxMoneyMinorSchema.nullable(),
					tax: taxMoneyMinorSchema.nullable(),
					grandTotal: taxMoneyMinorSchema.nullable(),
				})
				.strict(),
			lineAllocations: z.array(taxQuoteV2AllocationSchema).min(1).max(100),
		})
		.strict(),
	failure: z
		.object({
			code: z.literal("TAX_QUOTE_V2_FAILED"),
			message: z.string().min(1).max(200),
		})
		.strict(),
});
