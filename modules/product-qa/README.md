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

# Product Q&A Module

📚 **Documentation:** [86d.app/docs/modules/product-qa](https://86d.app/docs/modules/product-qa)

Product-specific questions and answers for e-commerce storefronts. Customers can ask questions about products, and merchants or other customers can provide answers. Includes moderation, upvoting, and analytics.

## Installation

```sh
npm install @86d-app/product-qa
```

## Usage

```ts
import productQa from "@86d-app/product-qa";

const module = productQa({
  autoPublish: "true", // skip moderation queue
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `autoPublish` | `string` | `undefined` | Set to `"true"` to auto-publish questions without moderation |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/product-qa/questions` | Submit a question about a product |
| `GET` | `/product-qa/products/:productId/questions` | List published questions for a product (with answers) |
| `GET` | `/product-qa/products/:productId/summary` | Get Q&A summary (counts) for a product |
| `POST` | `/product-qa/questions/:questionId/answer` | Submit an answer to a question |
| `GET` | `/product-qa/questions/:questionId/answers` | List published answers for a question |
| `POST` | `/product-qa/questions/:id/upvote` | Upvote a question |
| `POST` | `/product-qa/answers/:id/upvote` | Upvote an answer |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/product-qa/questions` | List all questions (filterable by status, productId) |
| `GET` | `/admin/product-qa/questions/:id` | Get question detail with all answers |
| `POST` | `/admin/product-qa/questions/:id/publish` | Publish a pending question |
| `POST` | `/admin/product-qa/questions/:id/reject` | Reject a question |
| `POST` | `/admin/product-qa/questions/:id/delete` | Delete a question and its answers |
| `POST` | `/admin/product-qa/questions/:id/answer` | Post an official merchant answer |
| `POST` | `/admin/product-qa/answers/:id/publish` | Publish a pending answer |
| `POST` | `/admin/product-qa/answers/:id/reject` | Reject an answer |
| `POST` | `/admin/product-qa/answers/:id/delete` | Delete an answer |
| `GET` | `/admin/product-qa/analytics` | Get Q&A analytics |

## Controller API

```ts
interface ProductQaController {
  // Questions
  createQuestion(params: { productId, authorName, authorEmail, body, customerId? }): Promise<Question>;
  getQuestion(id: string): Promise<Question | null>;
  listQuestionsByProduct(productId, params?): Promise<Question[]>;
  listQuestions(params?): Promise<Question[]>;
  updateQuestionStatus(id, status): Promise<Question | null>;
  deleteQuestion(id: string): Promise<boolean>;
  upvoteQuestion(id: string): Promise<Question | null>;

  // Answers
  createAnswer(params: { questionId, productId, authorName, authorEmail, body, customerId?, isOfficial? }): Promise<Answer>;
  getAnswer(id: string): Promise<Answer | null>;
  listAnswersByQuestion(questionId, params?): Promise<Answer[]>;
  updateAnswerStatus(id, status): Promise<Answer | null>;
  deleteAnswer(id: string): Promise<boolean>;
  upvoteAnswer(id: string): Promise<Answer | null>;

  // Analytics
  getProductQaSummary(productId: string): Promise<ProductQaSummary>;
  getQaAnalytics(): Promise<QaAnalytics>;
}
```

## Types

```ts
type QuestionStatus = "pending" | "published" | "rejected";
type AnswerStatus = "pending" | "published" | "rejected";

interface Question {
  id: string;
  productId: string;
  customerId?: string;
  authorName: string;
  authorEmail: string;
  body: string;
  status: QuestionStatus;
  upvoteCount: number;
  answerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Answer {
  id: string;
  questionId: string;
  productId: string;
  customerId?: string;
  authorName: string;
  authorEmail: string;
  body: string;
  isOfficial: boolean;
  upvoteCount: number;
  status: AnswerStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductQaSummary {
  questionCount: number;
  answeredCount: number;
  unansweredCount: number;
}

interface QaAnalytics {
  totalQuestions: number;
  pendingQuestions: number;
  publishedQuestions: number;
  rejectedQuestions: number;
  totalAnswers: number;
  pendingAnswers: number;
  publishedAnswers: number;
  officialAnswers: number;
  averageAnswersPerQuestion: number;
  unansweredCount: number;
}
```

## Store Components

| Component | Description |
|-----------|-------------|
| `ProductQuestions` | Q&A section for product pages showing published questions with answers |
| `QuestionForm` | Form to submit a new question about a product |
| `QuestionCard` | Individual question display with answer count and upvote button |
| `AnswerList` | List of answers for a specific question with upvoting |

### Usage

```tsx
import { ProductQuestions, QuestionForm } from "@86d-app/product-qa/store/components";

<ProductQuestions productId="abc-123" />
<QuestionForm productId="abc-123" />
```

## Notes

- Questions and answers go through a moderation queue by default (`pending` → `published`/`rejected`). Set `autoPublish: "true"` to skip moderation.
- Official merchant answers are always auto-published regardless of the `autoPublish` setting.
- The `answerCount` on questions is automatically maintained when answers are created or deleted.
- Deleting a question cascades to remove all associated answers.
- Store endpoints only return published content; admin endpoints return all statuses for moderation.
- All text input (`body`, `authorName`) is sanitized via `sanitizeText` to prevent XSS.
