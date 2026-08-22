/**
 * @86d-app/core/zod
 *
 * Zod gateway for Modules.
 *
 * Modules depend only on `@86d-app/core`, so zod has to reach them through this
 * package. It lives in its own file rather than in `./api` so that a Module's
 * `schema.ts` — which wants nothing but `z` — does not pull `better-call` and the
 * endpoint factories into its module graph. Same reasoning as `./state`, which was
 * split out to keep `mobx-react-lite` off the server.
 */

import { z as zodZ } from "zod";

export type { infer as ZodInfer, ZodSchema, ZodType } from "zod";

/** Runtime Zod namespace (local binding — avoids export-from barrel rules). */
export const z = zodZ;
