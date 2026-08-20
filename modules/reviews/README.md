<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Reviews Module

📚 **Documentation:** [86d.app/docs/modules/reviews](https://86d.app/docs/modules/reviews)

Product reviews and ratings for the 86d commerce platform. Supports moderation queue, photo reviews, helpfulness voting with deduplication, review sorting, abuse reporting, and merchant responses.

![version](https://img.shields.io/badge/version-0.0.2-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Installation

```sh
npm install @86d-app/reviews
```

## Usage

```ts
import reviews from "@86d-app/reviews";
import { createModuleClient } from "@86d-app/core";

const client = createModuleClient([
  reviews({
    autoApprove: "false",  // default: requires moderation
  }),
]);
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `autoApprove` | `"true" \| "false"` | `"false"` | Auto-approve reviews without moderation |

## Review Lifecycle

```
createReview()         → pending
updateReviewStatus()   → approved  (publicly visible)
updateReviewStatus()   → rejected  (hidden from store)
```

When `autoApprove: "true"`, new reviews skip the pending state and go directly to `approved`.

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/reviews` | Submit a review (with optional images, duplicate prevention) |
| `GET` | `/reviews/me` | List authenticated user's reviews (paginated) |
| `GET` | `/reviews/products/:productId` | List approved reviews + rating summary (sortable) |
| `POST` | `/reviews/:id/helpful` | Vote review as helpful (deduplicated for auth users) |
| `POST` | `/reviews/:id/report` | Report a review for abuse/spam |

### Submit Review (`POST /reviews`)

```json
{
  "productId": "prod_abc",
  "authorName": "Jane Doe",
  "authorEmail": "jane@example.com",
  "rating": 5,
  "title": "Excellent product!",
  "body": "Exactly what I needed.",
  "images": [
    { "url": "https://example.com/photo.jpg", "caption": "Front view" }
  ]
}
```

Returns `409` if the authenticated customer has already reviewed this product.

### List Product Reviews (`GET /reviews/products/:productId`)

Query parameters:
- `take` (1–100, default 20) — page size
- `skip` (default 0) — offset
- `sortBy` — `recent` | `oldest` | `highest` | `lowest` | `helpful` (default: `recent`)

```json
{
  "reviews": [...],
  "summary": {
    "average": 4.3,
    "count": 12,
    "distribution": { "1": 0, "2": 1, "3": 2, "4": 4, "5": 5 }
  }
}
```

### Report Review (`POST /reviews/:id/report`)

```json
{
  "reason": "spam",
  "details": "This review is advertising another product"
}
```

Reason must be one of: `spam`, `offensive`, `fake`, `irrelevant`, `harassment`, `other`.

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/reviews` | List all reviews (filter: `status`, `productId`) |
| `GET` | `/admin/reviews/analytics` | Review analytics (includes report counts) |
| `GET` | `/admin/reviews/reports` | List abuse reports (filter: `status`, `reviewId`) |
| `PUT` | `/admin/reviews/reports/:id/update` | Resolve or dismiss a report |
| `GET` | `/admin/reviews/requests` | List review request emails |
| `GET` | `/admin/reviews/request-stats` | Review request statistics |
| `POST` | `/admin/reviews/send-request` | Send a review request email |
| `GET` | `/admin/reviews/:id` | Get a single review |
| `PUT` | `/admin/reviews/:id/approve` | Approve a review |
| `PUT` | `/admin/reviews/:id/reject` | Reject a review |
| `POST` | `/admin/reviews/:id/respond` | Add merchant response |
| `DELETE` | `/admin/reviews/:id/delete` | Delete a review permanently |

## Controller API

```ts
controller.createReview(params: {
  productId: string;
  authorName: string;
  authorEmail: string;
  rating: number;          // 1–5
  title?: string;
  body: string;
  customerId?: string;
  isVerifiedPurchase?: boolean;
  images?: Array<{ url: string; caption?: string }>;
}): Promise<Review>

controller.getReview(id: string): Promise<Review | null>

controller.listReviewsByProduct(productId: string, params?: {
  approvedOnly?: boolean;
  take?: number;
  skip?: number;
  sortBy?: "recent" | "oldest" | "highest" | "lowest" | "helpful";
}): Promise<Review[]>

controller.listReviews(params?: {
  productId?: string;
  status?: ReviewStatus;
  take?: number;
  skip?: number;
}): Promise<Review[]>

controller.updateReviewStatus(id: string, status: ReviewStatus): Promise<Review | null>

controller.deleteReview(id: string): Promise<boolean>

controller.getProductRatingSummary(productId: string): Promise<RatingSummary>

controller.hasReviewedProduct(customerId: string, productId: string): Promise<boolean>

controller.voteHelpful(reviewId: string, voterId: string): Promise<{
  review: Review;
  alreadyVoted: boolean;
} | null>

controller.markHelpful(id: string): Promise<Review | null>

controller.reportReview(params: {
  reviewId: string;
  reporterId?: string;
  reason: string;
  details?: string;
}): Promise<ReviewReport>

controller.listReports(params?: {
  status?: ReportStatus;
  reviewId?: string;
  take?: number;
  skip?: number;
}): Promise<ReviewReport[]>

controller.updateReportStatus(id: string, status: ReportStatus): Promise<ReviewReport | null>

controller.getReportCount(reviewId: string): Promise<number>
```

## Types

```ts
type ReviewStatus = "pending" | "approved" | "rejected";
type ReportStatus = "pending" | "resolved" | "dismissed";
type ReviewSortBy = "recent" | "oldest" | "highest" | "lowest" | "helpful";

interface ReviewImage {
  url: string;
  caption?: string;
}

interface Review {
  id: string;
  productId: string;
  customerId?: string;
  authorName: string;
  authorEmail: string;
  rating: number;          // 1–5
  title?: string;
  body: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  images?: ReviewImage[];
  merchantResponse?: string;
  merchantResponseAt?: Date;
  moderationNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ReviewVote {
  id: string;
  reviewId: string;
  voterId: string;
  createdAt: Date;
}

interface ReviewReport {
  id: string;
  reviewId: string;
  reporterId?: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  createdAt: Date;
}

interface RatingSummary {
  average: number;
  count: number;
  distribution: Record<string, number>;
}

interface ReviewAnalytics {
  totalReviews: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  averageRating: number;
  ratingsDistribution: Record<string, number>;
  withMerchantResponse: number;
  reportedCount: number;
}
```

## Store Components

### ReviewsSummary

Compact star rating and count for product cards.

| Prop | Type | Description |
|------|------|-------------|
| `productId` | `string` | Product ID to fetch review summary for |

```mdx
<ReviewsSummary productId={product.id} />
```

### ProductReviews

Full reviews section with summary, distribution bars, review list, and submit form.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `productId` | `string` | — | Product ID |
| `title` | `string` | `"Customer Reviews"` | Section heading |

```mdx
<ProductReviews productId={product.id} />
```

## Notes

- Only approved reviews appear in product listings and rating summaries
- Authenticated customers can only submit one review per product
- Helpfulness votes are deduplicated for authenticated users (anonymous votes are not tracked)
- Report reasons are enum-validated; details are sanitized
- Images are validated as URLs with a max of 5 per review
