import {
	createEndpoint,
	createMiddleware,
	createRouter,
	type EndpointContext,
	type EndpointOptions,
	type Middleware,
	type StrictEndpoint,
} from "better-call";
import { type EndpointExposure, isEndpointExposure } from "./endpoint-exposure";
import type {
	ModuleContext,
	ModuleControllers,
	ModuleEntityMap,
	Session,
} from "./types/module";
import { z } from "./zod";

type AdminContext = ModuleContext & {
	session: NonNullable<ModuleContext["session"]>;
};

type PostHookContext = {
	returned?: unknown;
	responseHeaders?: Headers;
};

type EndpointHandler<
	Ctx,
	Path extends string,
	Options extends EndpointOptions,
	R,
> = (context: EndpointContext<Path, Options, Ctx>) => Promise<R>;

/** Post-hook middleware for response handling. */
const postHookMiddleware = createMiddleware(
	async () => ({}) as PostHookContext,
);

/**
 * Creates an options middleware that provides the given context type.
 * The context is injected at runtime by the caller.
 */
function createOptionsMiddleware<Ctx>() {
	return createMiddleware(async () => ({}) as Ctx);
}

/**
 * Creates a middleware factory with the given options middleware and post-hook support.
 */
function createMiddlewareFactory(optionsMiddleware: Middleware) {
	return createMiddleware.create({
		use: [optionsMiddleware, postHookMiddleware],
	});
}

/**
 * Creates an endpoint factory function with the given options middleware.
 * Supports both path-based and path-less endpoint signatures.
 *
 * Every endpoint the factory produces carries an `exposure`. The admin factory
 * fixes it, because that surface is authenticated by construction. The store
 * factory takes `shopper` unless the endpoint declares otherwise, so a provider
 * webhook or an internal endpoint has to say so instead of being inferred from
 * its path at request time.
 */
function createEndpointFactory<Ctx>(
	optionsMiddleware: Middleware,
	surfaceExposure: EndpointExposure,
	fixedExposure: boolean,
) {
	// Overload: with path
	function factory<Path extends string, Options extends EndpointOptions, R>(
		path: Path,
		options: Options,
		handler: EndpointHandler<Ctx, Path, Options, R>,
	): StrictEndpoint<Path, Options, R>;

	// Overload: without path
	function factory<Path extends string, Options extends EndpointOptions, R>(
		options: Options,
		handler: EndpointHandler<Ctx, Path, Options, R>,
	): StrictEndpoint<Path, Options, R>;

	// Implementation
	function factory<Path extends string, Opts extends EndpointOptions, R>(
		pathOrOptions: Path | Opts,
		handlerOrOptions: EndpointHandler<Ctx, Path, Opts, R> | Opts,
		maybeHandler?: EndpointHandler<Ctx, Path, Opts, R>,
	) {
		const hasPath = typeof pathOrOptions === "string";
		const path = hasPath ? pathOrOptions : undefined;
		const options = (hasPath ? handlerOrOptions : pathOrOptions) as Opts;
		const handler = (
			hasPath ? maybeHandler : handlerOrOptions
		) as EndpointHandler<Ctx, Path, Opts, R>;

		const declared = (options as EndpointOptions & { exposure?: unknown })
			?.exposure;
		if (declared !== undefined && !isEndpointExposure(declared)) {
			throw new Error(
				`Endpoint "${path ?? "<unnamed>"}" declares unrecognized exposure ${JSON.stringify(declared)}.`,
			);
		}
		if (
			fixedExposure &&
			declared !== undefined &&
			declared !== surfaceExposure
		) {
			throw new Error(
				`Endpoint "${path ?? "<unnamed>"}" cannot declare exposure "${declared}" on the ${surfaceExposure} surface.`,
			);
		}

		const mergedOptions = {
			...options,
			exposure: fixedExposure ? surfaceExposure : (declared ?? surfaceExposure),
			use: [...(options?.use || []), optionsMiddleware],
		};

		return path
			? createEndpoint(path, mergedOptions, async (ctx) => handler(ctx))
			: createEndpoint(mergedOptions, async (ctx) => handler(ctx));
	}

	return factory;
}

export const storeOptionsMiddleware = createOptionsMiddleware<ModuleContext>();
export const createStoreMiddleware = createMiddlewareFactory(
	storeOptionsMiddleware,
);
export const createStoreEndpoint = createEndpointFactory<ModuleContext>(
	storeOptionsMiddleware,
	"shopper",
	false,
);

export const adminOptionsMiddleware = createOptionsMiddleware<AdminContext>();
export const createAdminMiddleware = createMiddlewareFactory(
	adminOptionsMiddleware,
);
export const createAdminEndpoint = createEndpointFactory<AdminContext>(
	adminOptionsMiddleware,
	"admin",
	true,
);

/**
 * Typed endpoint factories.
 *
 * `createStoreEndpoint` / `createAdminEndpoint` pin `ModuleContext` to its defaults,
 * which erases both the Module's controllers and its entity shapes — that erasure is
 * what forces `ctx.context.controllers.cart as CartController` at every call site.
 * These curried variants carry both generics, so a Module gets typed controllers AND
 * typed `ctx.context.data` from a single declaration.
 *
 * @example
 * const createEndpoint = createStoreEndpointFor<
 *   { cart: CartController },
 *   CartEntities
 * >();
 *
 * export const getCart = createEndpoint("/cart/get", { method: "GET" }, async (ctx) => {
 *   const cart = await ctx.context.data.get("cart", id);   // Cart | null
 *   return ctx.context.controllers.cart.getCartItems(id);  // typed, no cast
 * });
 */
export const createStoreEndpointFor = <
	C extends ModuleControllers,
	E extends ModuleEntityMap = ModuleEntityMap,
>() =>
	createEndpointFactory<ModuleContext<C, E>>(
		storeOptionsMiddleware,
		"shopper",
		false,
	);

export const createAdminEndpointFor = <
	C extends ModuleControllers,
	E extends ModuleEntityMap = ModuleEntityMap,
>() =>
	createEndpointFactory<ModuleContext<C, E> & { session: Session }>(
		adminOptionsMiddleware,
		"admin",
		true,
	);

export type StoreEndpoint<
	Path extends string,
	Opts extends EndpointOptions,
	R,
> = StrictEndpoint<Path, Opts, R>;

export type AdminEndpoint<
	Path extends string,
	Opts extends EndpointOptions,
	R,
> = StrictEndpoint<Path, Opts, R>;

export type StoreMiddleware = ReturnType<typeof createStoreMiddleware>;
export type AdminMiddleware = ReturnType<typeof createAdminMiddleware>;

export type StoreEndpointContext<
	Path extends string = string,
	Opts extends EndpointOptions = EndpointOptions,
> = EndpointContext<Path, Opts, ModuleContext>;

export type AdminEndpointContext<
	Path extends string = string,
	Opts extends EndpointOptions = EndpointOptions,
> = EndpointContext<Path, Opts, AdminContext>;

export type {
	Endpoint,
	EndpointContext,
	InputContext,
	Middleware,
	RouterConfig,
} from "better-call";
// Re-exported from ./zod so that a Module's schema.ts can import `z` without
// pulling better-call and the endpoint factories into its module graph.
export type { ZodInfer, ZodSchema, ZodType } from "./zod";
export {
	// createEndpoint,
	createRouter,
	z,
};
