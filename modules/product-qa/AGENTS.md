# Product Q&A Module

Product-specific questions and answers for customer-facing product pages. Distinct from reviews (ratings), FAQ (store-wide), and tickets (private support).

## Structure

```
src/
  index.ts          Factory: productQa(options?) => Module + admin nav registration
  schema.ts         Models: question, answer
  service.ts        ProductQaController interface
  service-impl.ts   ProductQaController implementation
  store/
    endpoints/
      submit-question.ts         POST /product-qa/questions
      list-product-questions.ts  GET  /product-qa/products/:productId/questions
      submit-answer.ts           POST /product-qa/questions/:questionId/answer
      list-answers.ts            GET  /product-qa/questions/:questionId/answers
      upvote-question.ts         POST /product-qa/questions/:id/upvote
      upvote-answer.ts           POST /product-qa/answers/:id/upvote
      product-qa-summary.ts      GET  /product-qa/products/:productId/summary
    components/                  Customer-facing components
      _hooks.ts                  API hooks (useProductQaApi)
      _utils.ts                  Shared utilities
      index.tsx                  Component exports
      *.tsx                      Component logic
      *.mdx                      Component templates
  admin/
    endpoints/
      list-questions.ts          GET  /admin/product-qa/questions
      get-question.ts            GET  /admin/product-qa/questions/:id
      publish-question.ts        POST /admin/product-qa/questions/:id/publish
      reject-question.ts         POST /admin/product-qa/questions/:id/reject
      delete-question.ts         POST /admin/product-qa/questions/:id/delete
      post-official-answer.ts    POST /admin/product-qa/questions/:id/answer
      publish-answer.ts          POST /admin/product-qa/answers/:id/publish
      reject-answer.ts           POST /admin/product-qa/answers/:id/reject
      delete-answer.ts           POST /admin/product-qa/answers/:id/delete
      qa-analytics.ts            GET  /admin/product-qa/analytics
```

## Options

```ts
ProductQaOptions {
  autoPublish?: string  // "true" to skip moderation queue
}
```

## Data models

- **question**: id, productId, customerId?, authorName, authorEmail, body, status (pending|published|rejected), upvoteCount, answerCount, createdAt, updatedAt
- **answer**: id, questionId, productId, customerId?, authorName, authorEmail, body, isOfficial, upvoteCount, status (pending|published|rejected), createdAt, updatedAt

## Patterns

- Questions and answers go through moderation (pending → published/rejected) unless `autoPublish` is set
- Official answers from merchants are auto-published and marked with `isOfficial: true`
- `answerCount` on questions is maintained automatically when answers are created/deleted
- Deleting a question cascades to delete all its answers
- Store endpoints only return published questions/answers; admin endpoints return all statuses
- Upvote counts are increment-only (no undo)

## Tests

- `service-impl.test.ts` — controller unit tests
- `endpoint-security.test.ts` — 36 tests covering storefront/answer visibility, cascade deletion, answer count tracking, upvote safety, product scoping, nonexistent resource guards, analytics accuracy, product QA summary, and autoPublish mode
