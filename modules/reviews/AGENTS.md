# Reviews Module

Product reviews, ratings, reporting, and helpfulness voting. Reviews start as `pending` and require admin approval before being publicly visible (unless `autoApprove` is set).

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Module factory, options, type re-exports
  schema.ts             review, reviewVote, reviewReport tables
  service.ts            ReviewController interface + types
  service-impl.ts       Controller implementation
  store/endpoints/      5 public endpoints
  store/components/     Customer-facing review UI (TSX + MDX)
  admin/endpoints/      12 admin endpoints
  admin/components/     Admin review management UI
  __tests__/            4 test files (246 tests)
```

## Schema

- `review` — rating (1–5), author info, body, images, moderation status, helpfulness count, merchant response
- `reviewVote` — tracks who voted helpful (reviewId + voterId) for deduplication
- `reviewReport` — abuse/spam reports (reviewId, reason, status: pending/resolved/dismissed)

## Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoApprove` | `"true" \| "false"` | `"false"` | Skip moderation queue |

## Patterns

- **Duplicate prevention**: `hasReviewedProduct(customerId, productId)` — one review per customer per product (enforced in submit endpoint for authenticated users)
- **Vote deduplication**: `voteHelpful(reviewId, voterId)` — authenticated users can only vote once per review; anonymous users get simple `markHelpful` increment
- **Sorting**: `listReviewsByProduct` supports `sortBy`: recent, oldest, highest, lowest, helpful
- **Photo reviews**: `images` field accepts up to 5 `{url, caption?}` objects
- **Reporting**: customers can report reviews as spam/offensive/fake/irrelevant/harassment/other
- **Analytics**: `getReviewAnalytics()` includes `reportedCount` (unique reviews with pending reports)

## Endpoints

### Store
- `POST /reviews` — submit review (duplicate check, images, sanitized input)
- `GET /reviews/me` — list authenticated user's reviews (paginated)
- `GET /reviews/products/:productId` — approved reviews + summary (sortBy: recent/oldest/highest/lowest/helpful)
- `POST /reviews/:id/helpful` — vote helpful (deduplicated for auth users)
- `POST /reviews/:id/report` — report review (reason + optional details)

### Admin
- `GET /admin/reviews` — list all reviews (status/productId filters)
- `GET /admin/reviews/analytics` — review analytics (includes reportedCount)
- `GET /admin/reviews/reports` — list reports (status/reviewId filters)
- `PUT /admin/reviews/reports/:id/update` — resolve/dismiss a report
- `GET /admin/reviews/requests` — list review request emails
- `GET /admin/reviews/request-stats` — review request stats
- `POST /admin/reviews/send-request` — send review request email
- `GET /admin/reviews/:id` — get single review
- `PUT /admin/reviews/:id/approve` — approve
- `PUT /admin/reviews/:id/reject` — reject
- `POST /admin/reviews/:id/respond` — add merchant response
- `DELETE /admin/reviews/:id/delete` — delete

## Security

- `customerId` derived from session — never accepted from client
- `isVerifiedPurchase` always `false` from store endpoint — only admin/system can set
- Report `reason` is enum-validated (spam, offensive, fake, irrelevant, harassment, other)
- Image URLs validated as URLs; captions sanitized
- All text inputs sanitized via `sanitizeText`

## Tests

- `service-impl.test.ts` — 109 controller unit tests
- `controllers.test.ts` — 52 edge case tests
- `endpoint-security.test.ts` — 45 security regression tests
- `new-features.test.ts` — 40 tests covering photos, duplicate prevention, vote dedup, sorting, reporting, analytics
