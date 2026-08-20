/**
 * @86d-app/core/client/react-query
 *
 * SSR hydration primitives re-exported from @tanstack/react-query.
 *
 * Modules depend only on `@86d-app/core`, and `apps/store` does not declare
 * `@tanstack/react-query` either — so these have to reach consumers through this
 * package. Kept in their own file rather than in `./provider` so that importing
 * `dehydrate` does not also pull the client provider and its "use client"
 * boundary into a server component's module graph.
 */

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export { dehydrate, HydrationBoundary };
