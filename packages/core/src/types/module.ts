import type {
	Endpoint,
	EndpointContext,
	InputContext,
	Middleware,
} from "better-call";
import type { CapabilityInvoker, ModuleCapabilities } from "../capabilities";
import type {
	AnyDurableEventConsumer,
	AnyDurableEventDefinition,
	ModuleTransactionRunner,
} from "../durable-events";
import type { EventHandler, ScopedEventEmitter } from "../events";
import type {
	AnchorDeclaration,
	CoreExtensionDeclaration,
	PublishedView,
	TableDeclaration,
} from "../schema/declaration";
import type { Awaitable, LiteralString, Primitive } from "./helper";
import type { ModuleSchema } from "./schema";

export type ModuleId = string;

/**
 * Lifecycle status of a module within the registry.
 */
export type ModuleStatus =
	| "pending"
	| "initializing"
	| "ready"
	| "error"
	| "stopped";

/**
 * Legacy compatibility metadata describing fields associated with a Module.
 * The runtime may validate this declaration against `requires`, but it never
 * grants another Module access to data or controllers. Use typed capabilities
 * for immediate cross-Module decisions.
 *
 * - `read`: Fields historically declared as readable
 * - `readWrite`: Fields historically declared as writable
 *
 * @example
 * ```ts
 * exports: {
 *   read: ["customerName", "customerEmail"],
 *   readWrite: ["customerMetadata"]
 * }
 * ```
 */
export interface ModuleExports {
	read?: string[];
	readWrite?: string[];
}

/**
 * Legacy compatibility metadata describing another Module's declared fields.
 * The runtime validates that every consumer requirement is a subset of the
 * provider declaration, but this metadata does not expose the provider's data,
 * controllers, or configuration. Use typed capabilities for cross-Module work.
 *
 * @example
 * ```ts
 * requires: {
 *   "@86d-app/customers": { read: ["customerName", "customerEmail"] },
 *   "@86d-app/products": { read: ["productPrice"], readWrite: ["productStock"] }
 * }
 * ```
 */
export type ModuleRequires = Record<
	string,
	{
		read?: string[];
		readWrite?: string[];
		/** If true, the module works without this dependency. Violations are warnings, not errors. */
		optional?: boolean;
	}
>;

/**
 * Describes a violation in the inter-module contract system.
 */
export interface ContractViolation {
	/** The module that has an unsatisfied requirement */
	consumerId: string;
	/** The module that should provide the data */
	providerId: string;
	/** The specific field that is missing or has insufficient access */
	field: string;
	/** What kind of access was requested */
	requestedAccess: "read" | "readWrite";
	/** Why the requirement was not met */
	reason: "module_not_found" | "field_not_exported" | "insufficient_access";
}

/**
 * Admin page declaration: route path, component name, and optional sidebar metadata.
 * Path uses :param for dynamic segments (e.g. "/admin/products/:id/edit").
 * Only entries with `label` appear in the sidebar.
 */
export interface AdminPage {
	path: string;
	component: string;
	label?: string;
	icon?: string;
	group?: string;
	/**
	 * Optional subgroup within the group for 2-level sidebar navigation.
	 * When set, the item is nested under a collapsible subgroup header.
	 * If not set, the admin registry assigns one automatically based on the path.
	 */
	subgroup?: string;
}

/**
 * Store page declaration: route path and component name for customer-facing storefront.
 * Path uses :param for dynamic segments (e.g. "/products/:slug", "/collections/:slug").
 * Optional toMarkdown serializes this page for .md URL suffix (e.g. /products/shirt.md).
 */
export interface StorePage {
	path: string;
	component: string;
	/** Serialize this page to markdown for .md URL suffix. Receives ModuleContext and route params. */
	toMarkdown?: (
		ctx: ModuleContext,
		params: Record<string, string>,
	) => Promise<string | null>;
}

/**
 * Abstraction for CRUD operations on module entities.
 *
 * @example
 * const product = await dataService.get("product", "prod_123");
 * await dataService.upsert("cart", "cart_343", { ... });
 * const items = await dataService.findMany("cartItem", { where: { cartId: "cart_343" } });
 */
/**
 * Map of a Module's entity name to the shape stored under it.
 *
 * A Module declares this once from the domain types it already exports, e.g.
 * `type CartEntities = { cart: Cart; cartItem: CartItem }`. Threading it through
 * `ModuleDataService` lets reads and writes INFER instead of asserting.
 */
export type ModuleEntityMap = Record<string, Record<string, unknown>>;

/**
 * Abstraction for CRUD operations on module entities.
 *
 * The `E` parameter defaults to the untyped map, so every existing
 * `data: ModuleDataService` annotation keeps compiling unchanged.
 *
 * NOTE ON SAFETY: `get` returns whatever JSONB the database holds. An inferred
 * return type makes exactly the same unchecked assumption a cast did — it just
 * stops advertising it. Pair it with a runtime parse (see
 * `FieldAttributeConfig.validator` in ./schema, and `cartRecordSchema` in
 * modules/cart/src/service-impl.ts) where the data is not owner-controlled.
 *
 * @example
 * const cart = await data.get("cart", id);        // Cart | null, no cast
 * await data.upsert("cart", id, cart);            // accepts Cart, no cast
 */
export interface ModuleDataService<
	E extends ModuleEntityMap = ModuleEntityMap,
> {
	/**
	 * Get a single entity by ID.
	 *
	 * @example
	 * const product = await dataService.get("product", "prod_123");
	 */
	get<K extends keyof E & string>(
		entityType: K,
		entityId: string,
	): Promise<E[K] | null>;

	/**
	 * Create or update an entity.
	 *
	 * @example
	 * await dataService.upsert("product", "prod_new", { title: "New Product" });
	 */
	upsert<K extends keyof E & string>(
		entityType: K,
		entityId: string,
		data: E[K],
	): Promise<void>;

	/**
	 * Delete an entity.
	 *
	 * @example
	 * await dataService.delete("cartItem", "item_123");
	 */
	delete(entityType: keyof E & string, entityId: string): Promise<void>;

	/**
	 * Get a single Config value by declared key. Missing rows return `undefined`.
	 */
	getConfig?(key: string): Promise<unknown>;

	/**
	 * Upsert a Config value after parsing through the key's Zod schema.
	 */
	upsertConfig?(key: string, value: unknown): Promise<void>;

	/**
	 * Delete a Config key. Unknown keys fail closed.
	 */
	deleteConfig?(key: string): Promise<void>;

	/**
	 * Find many entities with optional filtering.
	 *
	 * @example
	 * const items = await dataService.findMany("cartItem", {
	 *   where: { cartId: "cart_1" },
	 *   orderBy: { createdAt: "desc" },
	 *   take: 10,
	 *   skip: 0
	 * });
	 */
	findMany<K extends keyof E & string>(
		entityType: K,
		options?: {
			where?: Record<string, unknown>;
			orderBy?: Record<string, "asc" | "desc">;
			take?: number;
			skip?: number;
		},
	): Promise<E[K][]>;
}

/**
 * Narrow a Module's data service to that Module's entity map.
 *
 * The runtime hands every Module the same untyped `ModuleDataService`, and
 * `Module` cannot be generic over the entity map: `init` takes the context as a
 * parameter, so a `Module<_, CartEntities>` is not assignable to the `Module[]`
 * the registry holds.
 *
 * So the assertion lives here — once per Module, named and greppable — instead of
 * being repeated at every read and write. It asserts the same thing those casts
 * did; it does not verify it. Where the rows are not owner-controlled, pair it with
 * a runtime parse (see `FieldAttributeConfig.validator` in ./schema).
 *
 * @example
 * init: async (ctx) => {
 *   const data = withEntities<CartEntities>(ctx.data);
 *   return { controllers: { cart: createCartControllers(data) } };
 * }
 */
export function withEntities<E extends ModuleEntityMap>(
	data: ModuleDataService,
): ModuleDataService<E> {
	return data as ModuleDataService<E>;
}

/**
 * Session information for authenticated requests.
 *
 * @example
 * const session: Session = {
 *   session: {
 *     id: "sess_123",
 *     createdAt: "2024-06-05T14:22:18.000Z",
 *     updatedAt: "2024-06-07T15:33:10.000Z",
 *     userId: "user_456",
 *     expiresAt: "2024-07-01T00:00:00.000Z",
 *     token: "jwt.token.string",
 *     ipAddress: "127.0.0.1",
 *     userAgent: "Mozilla/5.0",
 *     impersonatedBy: null,
 *     activeOrganizationId: "org_999",
 *     activeTeamId: null,
 *   },
 *   user: {
 *     id: "user_456",
 *     createdAt: "2023-01-02T10:00:00.000Z",
 *     updatedAt: "2024-06-07T15:33:10.000Z",
 *     email: "user@example.com",
 *     emailVerified: true,
 *     name: "Jane Doe",
 *     image: "https://example.com/avatar.png",
 *     banned: false,
 *     role: "admin",
 *     banReason: null,
 *     banExpires: null,
 *     phoneNumber: "+15555550123",
 *     phoneNumberVerified: true,
 *   }
 * }
 */
export type Session = {
	session: {
		id: string;
		createdAt: Date;
		updatedAt: Date;
		userId: string;
		expiresAt: Date;
		token: string;
		ipAddress?: string | null | undefined;
		userAgent?: string | null | undefined;
		impersonatedBy?: string | null | undefined;
		activeOrganizationId?: string | null | undefined;
		activeTeamId?: string | null | undefined;
	};
	user: {
		id: string;
		createdAt: Date;
		updatedAt: Date;
		email: string;
		emailVerified: boolean;
		name: string;
		image?: string | null | undefined;
		banned: boolean | null | undefined;
		role?: string | null | undefined;
		banReason?: string | null | undefined;
		banExpires?: Date | null | undefined;
		phoneNumber?: string | null | undefined;
		phoneNumberVerified?: boolean | null | undefined;
	};
};

/**
 * Per-module configuration options.
 * Extend this type to define module-specific options:
 *
 * @example
 * export interface CartOptions extends ModuleConfig {
 *   guestCartExpiration?: number;
 *   maxItemsPerCart?: number;
 * }
 */
export type ModuleConfig = Record<string, Primitive>;

/**
 * Merged module options from config (context-level).
 * Each key is a module ID, whose value is a flat object of primitive options.
 *
 * @example
 * const options: ModuleOptions = {
 *   products: { enableDiscounts: true, sort: "byPrice" },
 *   cart: { allowGuests: false, guestTimeoutMins: 60 }
 * };
 */
export type ModuleOptions = Record<string, ModuleConfig>;

/**
 * Base interface for owner-local compatibility controllers.
 *
 * A Module may use controllers to share implementation between its own init,
 * request, and shutdown paths. The runtime never exposes them to other Modules;
 * cross-Module decisions use typed capabilities instead.
 *
 * @example
 * // Define a controller for a cart module:
 * export interface CartController extends ModuleController {
 *   getOrCreateCart(params: { customerId?: string, guestId?: string }): Promise<Cart>;
 *   addItem(params: { cartId: string; productId: string; quantity: number }): Promise<CartItem>;
 * }
 *
 * // Access the current Module's controller from its own context:
 * const cartController = ctx.controllers.cart as CartController;
 * const cart = await cartController.getOrCreateCart({ customerId: "user_123" });
 *
 * ## Notes
 * - Controllers are visible only to the Module that owns them.
 * - Types extending `ModuleController` should define methods only.
 */
export interface ModuleController {
	// biome-ignore lint/suspicious/noExplicitAny: controller methods have varying parameter signatures — any[] is required for assignment compatibility
	[method: string]: (...args: any[]) => Awaitable<unknown>;
}

export type ModuleControllers = Record<string, ModuleController>;

/**
 * Context provided to hook matchers in module hooks.
 */
export type HookEndpointContext = Partial<
	// biome-ignore lint/suspicious/noExplicitAny: better-call EndpointOptions constraint requires any
	EndpointContext<string, any> & Omit<InputContext<string, any>, "method">
> & {
	path?: string;
	context: ModuleContext & {
		returned?: unknown | undefined;
		responseHeaders?: Headers | undefined;
	};
	headers?: Headers | undefined;
};

/**
 * The core context object provided to all modules at runtime.
 * Generic parameter C allows typed access to the current Module's controllers
 * when used with createStoreEndpoint/createAdminEndpoint.
 *
 * @example
 * const context: ModuleContext = {
 *   data: myDataService,
 *   modules: ["products", "cart"],
 *   options: { foo: true },
 *   session: session,
 *   controllers: { product: productController },
 *   storeId: "store_001"
 * };
 */
export type ModuleContext<
	C extends ModuleControllers = ModuleControllers,
	E extends ModuleEntityMap = ModuleEntityMap,
> = {
	/**
	 * Secure data access (scoped to compiled Module tables).
	 * Scoped to current module and store.
	 *
	 * @example
	 * await context.data.get("product", "prod_123")
	 */
	data: ModuleDataService<E>;

	/**
	 * List of enabled module IDs.
	 *
	 * @example
	 * ["products", "cart", "orders"]
	 */
	modules: string[];

	/**
	 * Configuration for the current Module only. Another Module's configuration
	 * is never exposed through this context.
	 */
	options: ModuleConfig;

	/**
	 * Session information (if authenticated).
	 * Undefined/null for unauthenticated requests.
	 */
	session?: Session | null | undefined;

	/**
	 * Controllers owned by the current Module, keyed by its local controller name.
	 * Generic type C allows typed owner-local access when passed to
	 * createStoreEndpoint/createAdminEndpoint.
	 *
	 * @example
	 * context.controllers.product.getProduct(ctx)
	 */
	controllers: C;

	/** Versioned, runtime-validated decisions accepted by this Module. */
	capabilities: CapabilityInvoker;

	/** Owner-local atomic state and durable-event transaction seam. */
	transactions?: ModuleTransactionRunner | undefined;

	/**
	 * Cross-Module money tables (`core.party` / `core.subject` / `core.transaction`).
	 * Injected by the Store Runtime for Modules that settle money.
	 */
	coreMoney?:
		| {
				write(input: {
					party: {
						id: string;
						kind: "person" | "organization";
						displayName?: string | null;
						email?: string | null;
					};
					subject: {
						id: string;
						kind: string;
						ownerModule: string;
						partyId: string;
						currency: string;
						expectedMinor: number;
						settleState: "open" | "settled" | "void";
					};
					transaction: {
						id: string;
						subjectId: string;
						authorizedMinor: number;
						capturedMinor?: number;
						refundedMinor?: number;
					};
				}): Promise<void>;
		  }
		| undefined;

	/**
	 * Store ID for current context.
	 *
	 * @example
	 * "store_123"
	 */
	storeId: string;

	/**
	 * Module-scoped event emitter for inter-module communication.
	 * Automatically sets the `source` field to the current module ID.
	 *
	 * @example
	 * ```ts
	 * // Emit an event
	 * await context.events.emit("order.placed", { orderId: "ord_123" });
	 *
	 * // Listen for events from other modules
	 * context.events.on("payment.completed", async (event) => {
	 *   // Update order status
	 * });
	 * ```
	 */
	events?: ScopedEventEmitter | undefined;
};

/**
 * The full contract describing a Module.
 *
 * @example
 * ```ts
 * export const products: Module = {
 *   id: "products",
 *   requires: ["inventory"],
 *   init: async (ctx) => ({
 *     controller: {
 *       getProduct: async (productId) => { ... },
 *       listProducts: async (options) => { ... },
 *       createProduct: async (product) => { ... },
 *     },
 *   }),
 *   endpoints: {
 *     store: {
 *       list: endpointBuilder(),
 *     },
 *   },
 *   schema: {
 *     product: {
 *       fields: {
 *         id: { type: "string" },
 *         title: { type: "string" },
 *       },
 *     },
 *   } as ModuleSchema,
 *   options: {
 *     enableFeatureX: true,
 *   },
 *   rateLimit: [
 *     {
 *       window: 60,
 *       max: 100,
 *       pathMatcher: (path) => path.startsWith("/store/products"),
 *     }
 *   ]
 * };
 * ```
 */
export type Module = {
	/**
	 * Unique string identifier for the module.
	 * Used to reference the module in dependencies, adapters, controllers, etc.
	 *
	 * @example "products"
	 */
	id: LiteralString;

	/**
	 * Version of the module.
	 * Used to check compatibility with other modules.
	 *
	 * @example "1.0.0"
	 */
	version: string;

	/**
	 * Canonical storage declaration. Required: `{ kind: "none" }`,
	 * `{ kind: "config", config }`, or `{ kind: "relational", ... }`.
	 */
	storage?: import("../schema/declaration").ModuleStorageDeclaration;

	/**
	 * Legacy compatibility metadata for declared fields. This never grants
	 * another Module access to this Module's data or controllers.
	 *
	 * @example
	 * ```ts
	 * exports: {
	 *   read: ["productTitle", "productPrice"],
	 *   readWrite: ["productStock"]
	 * }
	 * ```
	 */
	exports?: ModuleExports;

	/**
	 * Legacy compatibility metadata for dependencies on other Modules.
	 *
	 * **Simple form**: array of Module IDs. Runtime validates these Modules are
	 * initialized before this one.
	 *
	 * **Contract form**: object keyed by module ID, specifying which fields
	 * are needed and at what access level. Runtime validates that the
	 * provider's `exports` satisfy every requirement. Neither form grants data
	 * or controller access; use `capabilities` for cross-Module decisions.
	 *
	 * @example
	 * // Simple form
	 * requires: ["products", "inventory"]
	 *
	 * // Contract form
	 * requires: {
	 *   "products": { read: ["productTitle", "productPrice"] },
	 *   "inventory": { readWrite: ["productStock"] }
	 * }
	 */
	requires?:
		| string[]
		| ModuleRequires
		| readonly {
				module: string;
				versions: readonly import("../graph/contract-range").ContractRange[];
				optional?: true;
		  }[];

	/** Versioned decisions this Module provides or accepts. */
	capabilities?: ModuleCapabilities;

	controllers?: ModuleControllers;

	/**
	 * The init function is called when the module is initialized.
	 * It may return controllers owned by this Module. The runtime keeps those
	 * controllers local to the Module's init, request, and shutdown contexts.
	 *
	 * @example
	 * ```ts
	 * init: async (ctx) => ({
	 *   controllers: { local: {
	 *     doThing: () => ...
	 *     doAnotherThing: () => ...,
	 *   } },
	 * })
	 * ```
	 */
	init?:
		| ((ctx: ModuleContext) =>
				| Awaitable<{
						/**
						 * Controllers to register from init (useful when controllers need access to data service)
						 */
						controllers?: ModuleControllers;
				  }>
				| void
				| Promise<void>)
		| undefined;

	/**
	 * Cleanup hook called when the registry shuts down.
	 * Use this to release external connections, timers, or other resources.
	 *
	 * @example
	 * ```ts
	 * shutdown: async (ctx) => {
	 *   await externalClient.disconnect();
	 * }
	 * ```
	 */
	shutdown?: (ctx: ModuleContext) => Awaitable<void>;

	/**
	 * HTTP endpoints exposed by the module.
	 *
	 * @example
	 * ```ts
	 * endpoints: {
	 *   store: {
	 *     list: someEndpoint,
	 *   },
	 *   admin: {
	 *     reset: adminEndpoint,
	 *   }
	 * }
	 * ```
	 */
	endpoints?: {
		store?: Record<string, Endpoint>;
		admin?: Record<string, Endpoint>;
	};

	/**
	 * Optional search contribution: endpoint path(s) for store and/or admin command search.
	 * The module must expose the given path in endpoints.store or endpoints.admin.
	 * Omit or leave a key undefined to not contribute to that surface.
	 *
	 * @example
	 * ```ts
	 * search: { store: "/products/store-search" }
	 * search: { admin: "/admin-search" }
	 * search: { store: "/products/store-search", admin: "/admin-search" }
	 * ```
	 */
	search?: {
		store?: string;
		admin?: string;
	};

	/**
	 * Admin UI: routes and sidebar entries for the store admin.
	 * Modules declare pages (path, component name, optional label/icon/group for sidebar).
	 *
	 * @example
	 * ```ts
	 * admin: {
	 *   pages: [
	 *     { path: "/admin/carts", component: "CartList", label: "Carts", icon: "ShoppingCart", group: "Sales" },
	 *     { path: "/admin/products/:id/edit", component: "ProductForm" },
	 *   ],
	 * }
	 * ```
	 */
	admin?: {
		pages?: AdminPage[];
	};

	/**
	 * Store UI: routes for the customer-facing storefront.
	 * Modules declare pages (path, component name) for catch-all route resolution.
	 *
	 * @example
	 * ```ts
	 * store: {
	 *   pages: [
	 *     { path: "/products", component: "ProductGrid" },
	 *     { path: "/products/:slug", component: "ProductDetail" },
	 *     { path: "/collections/:slug", component: "CollectionDetail" },
	 *   ],
	 * }
	 * ```
	 */
	store?: {
		pages?: StorePage[];
	};

	/**
	 * Optional middleware to run for matching paths.
	 *
	 * @example
	 * ```ts
	 * middlewares: [
	 *   {
	 *     path: "/store/products/*",
	 *     middleware: someMiddleware,
	 *   }
	 * ]
	 * ```
	 */
	middlewares?: Array<{
		path: string;
		middleware: Middleware;
	}>;

	/**
	 * Hook to modify an incoming request before endpoint resolution.
	 *
	 * @example
	 * ```ts
	 * onRequest: async (request, ctx) => {
	 *   // Add custom header
	 *   request.headers.set("foo", "bar");
	 *   return { request };
	 * }
	 * ```
	 */
	onRequest?: (
		request: Request,
		ctx: ModuleContext,
	) => Promise<
		| {
				response: Response;
		  }
		| {
				request: Request;
		  }
		| undefined
	>;

	/**
	 * Hook to process or modify the Response after endpoint resolution.
	 *
	 * @example
	 * ```ts
	 * onResponse: async (response, ctx) => ({
	 *   response: new Response("custom", response),
	 * })
	 * ```
	 */
	onResponse?: (
		response: Response,
		ctx: ModuleContext,
	) => Promise<
		| {
				response: Response;
		  }
		| undefined
	>;

	/**
	 * Lifecycle hooks for endpoint processing and declared outcome hooks.
	 *
	 * - `before` / `after`: HTTP matcher hooks (request path).
	 * - `defines` / `implements`: build-time ordered outcome hooks (PRD contract).
	 */
	hooks?: {
		before?: Array<{
			matcher: (context: HookEndpointContext) => boolean;
			// handler: AuthMiddleware;
		}>;
		after?: Array<{
			matcher: (context: HookEndpointContext) => boolean;
			// handler: AuthMiddleware;
		}>;
		defines?: readonly import("../graph/hooks").AnyHookPointDefinition[];
		implements?: readonly import("../graph/hooks").AnyHookImplementation[];
	};

	/**
	 * Declared readers over another Module's published column-projected views.
	 */
	readers?: {
		accepts?: readonly import("../graph/projections").ReaderAcceptance[];
	};

	/**
	 * Template surfaces: versioned data projections and React components.
	 */
	templates?: {
		data?: Readonly<
			Record<
				string,
				| import("../graph/projections").AnyTemplateDataProjection
				| readonly import("../graph/projections").AnyTemplateDataProjection[]
			>
		>;
		// biome-ignore lint/suspicious/noExplicitAny: React component types are host-defined
		components?: Record<string, any>;
	};

	/**
	 * Describes the database schema the module needs.
	 * Used for DB migrations if desired.
	 *
	 * @example
	 * ```ts
	 * schema: {
	 *   cart: {
	 *     fields: {
	 *       id: { type: "string" },
	 *       status: { type: "string", defaultValue: "active" },
	 *     },
	 *   }
	 * } as ModuleSchema
	 * ```
	 */
	schema?: ModuleSchema;

	/** Compatibility declaration for own tables in `mod_<moduleId>`. Temporary inference from absence is not the target `storage.kind` contract. */
	tables?: Readonly<Record<string, TableDeclaration>>;

	/** Target storage: typed columns on a core table (`x_<moduleId>__*`). */
	extends?: Readonly<Record<string, CoreExtensionDeclaration>>;

	/** Money-bearing anchors to `core.subject`. */
	anchors?: readonly AnchorDeclaration[];

	/** Column-projected views granted to other Modules. */
	publishes?: Readonly<Record<string, PublishedView>>;

	// /**
	//  * The migrations of the plugin. If you define schema that will automatically create
	//  * migrations for you.
	//  *
	//  * ⚠️ Only use this if you don't want to use the schema option and you disabled migrations for
	//  * the tables.
	//  */
	// migrations?: Record<string, Migration> | undefined;

	/**
	 * Custom configuration options for the plugin.
	 *
	 * @example
	 * ```ts
	 * options: {
	 *   allowedRoles: ["admin", "manager"],
	 *   featureFlag: true,
	 * }
	 * ```
	 */
	options?: ModuleConfig | undefined;

	/**
	 * Rate limit rules scoped to certain paths.
	 *
	 * @example
	 * ```ts
	 * rateLimit: [
	 *   {
	 *     window: 60,
	 *     max: 100,
	 *     pathMatcher: (path) => path.startsWith("/store/products"),
	 *   }
	 * ]
	 * ```
	 */
	rateLimit?: Array<{
		window: number;
		max: number;
		pathMatcher: (path: string) => boolean;
	}>;

	/**
	 * Event declarations for inter-module communication.
	 *
	 * - `emits`: Array of event types this module can emit (documentation + validation).
	 * - `handles`: Map of event type → handler function. The runtime auto-wires these
	 *   during module initialization.
	 *
	 * @example
	 * ```ts
	 * events: {
	 *   emits: ["order.placed", "order.fulfilled"],
	 *   handles: {
	 *     "payment.completed": async (event) => {
	 *       // Fulfill the order
	 *     },
	 *   },
	 * }
	 * ```
	 */
	events?: {
		emits?: string[];
		handles?: Record<string, EventHandler>;
	};

	/** Versioned durable event contracts. Unlike `events`, these use the outbox. */
	durableEvents?: {
		emits?: readonly AnyDurableEventDefinition[] | undefined;
		handles?: readonly AnyDurableEventConsumer[] | undefined;
	};

	/**
	 * Shape types to be inferred by consumers.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: $Infer is a type-level inference marker that holds arbitrary shapes
	$Infer?: Record<string, any>;

	/**
	 * Error codes returned by the module, for client-side error handling.
	 *
	 * @example
	 * ```ts
	 * $ERROR_CODES: {
	 *   INVALID_REQUEST: { code: "INVALID_REQUEST", message: "Request is malformed." }
	 * }
	 * ```
	 */
	$ERROR_CODES?: Record<string, { code: string; message: string }>;
};
