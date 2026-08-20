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


# Blog Module

📚 **Documentation:** [86d.app/docs/modules/blog](https://86d.app/docs/modules/blog)

Blog content management module for the 86d commerce platform. Supports scheduled publishing, featured posts, related post suggestions, reading time estimation, view tracking, search, bulk operations, and SEO metadata.

## Installation

```sh
npm install @86d-app/blog
```

## Usage

```ts
import blog from "@86d-app/blog";

const module = blog({
  postsPerPage: "20",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `postsPerPage` | `string` | `"20"` | Number of posts returned per page |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/blog` | List published posts (paginated, filterable by category/tag) |
| `GET` | `/blog/featured` | List featured published posts |
| `GET` | `/blog/search` | Search published posts by title/content/excerpt |
| `GET` | `/blog/:slug` | Get a published post by slug |
| `GET` | `/blog/:slug/related` | Get related published posts |
| `POST` | `/blog/:slug/view` | Track a page view |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/blog` | List all posts (filterable by status/category/tag/featured/search) |
| `POST` | `/admin/blog/create` | Create a new post |
| `GET` | `/admin/blog/stats` | Get blog statistics (counts, views, categories, tags) |
| `POST` | `/admin/blog/bulk/status` | Bulk update post status |
| `POST` | `/admin/blog/bulk/delete` | Bulk delete posts |
| `POST` | `/admin/blog/check-scheduled` | Publish scheduled posts whose time has passed |
| `GET` | `/admin/blog/:id` | Get a post by ID |
| `PUT` | `/admin/blog/:id/update` | Update a post |
| `DELETE` | `/admin/blog/:id/delete` | Delete a post |
| `POST` | `/admin/blog/:id/publish` | Publish a post |
| `POST` | `/admin/blog/:id/unpublish` | Revert post to draft |
| `POST` | `/admin/blog/:id/archive` | Archive a post |
| `POST` | `/admin/blog/:id/duplicate` | Duplicate a post as draft |

## Controller API

```ts
interface BlogController {
  createPost(params: {
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    coverImage?: string;
    author?: string;
    status?: PostStatus;
    tags?: string[];
    category?: string;
    featured?: boolean;
    metaTitle?: string;
    metaDescription?: string;
    scheduledAt?: Date;
  }): Promise<BlogPost>;

  updatePost(id: string, params: Partial<CreatePostParams>): Promise<BlogPost | null>;
  deletePost(id: string): Promise<boolean>;
  getPost(id: string): Promise<BlogPost | null>;
  getPostBySlug(slug: string): Promise<BlogPost | null>;
  publishPost(id: string): Promise<BlogPost | null>;
  unpublishPost(id: string): Promise<BlogPost | null>;
  archivePost(id: string): Promise<BlogPost | null>;
  duplicatePost(id: string): Promise<BlogPost | null>;
  incrementViews(id: string): Promise<BlogPost | null>;
  listPosts(params?: {
    status?: PostStatus;
    category?: string;
    tag?: string;
    featured?: boolean;
    search?: string;
    take?: number;
    skip?: number;
  }): Promise<BlogPost[]>;
  getRelatedPosts(id: string, limit?: number): Promise<BlogPost[]>;
  getStats(): Promise<PostStats>;
  checkScheduledPosts(): Promise<BlogPost[]>;
  bulkUpdateStatus(ids: string[], status: PostStatus): Promise<{ updated: number; failed: string[] }>;
  bulkDelete(ids: string[]): Promise<{ deleted: number; failed: string[] }>;
}
```

## Types

```ts
type PostStatus = "draft" | "published" | "scheduled" | "archived";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  author?: string;
  status: PostStatus;
  tags: string[];
  category?: string;
  featured: boolean;
  readingTime: number;
  metaTitle?: string;
  metaDescription?: string;
  scheduledAt?: Date;
  publishedAt?: Date;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PostStats {
  total: number;
  draft: number;
  published: number;
  scheduled: number;
  archived: number;
  totalViews: number;
  categories: Array<{ category: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
}
```

## Store Components

### BlogList

Lists blog posts with optional category and tag filters.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | `number` | `20` | Max posts to show |
| `category` | `string` | — | Filter by category |
| `tag` | `string` | — | Filter by tag |

#### Usage in MDX

```mdx
<BlogList />
<BlogList limit={10} category="News" />
```

### BlogPostDetail

Blog post detail page. Used as a store page component (receives `params.slug` from route).

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `slug` | `string` | Post slug (from URL) |
| `params` | `Record<string, string>` | Route params (params.slug) |

#### Usage

Loaded dynamically by the store catch-all route for `/blog/:slug`.

## Notes

- **Scheduled publishing**: Set `status: "scheduled"` with a `scheduledAt` date. Call the `check-scheduled` admin endpoint periodically (e.g., via cron) to auto-publish posts whose scheduled time has passed.
- **Reading time**: Auto-calculated at ~200 words per minute. Updates when content changes.
- **Related posts**: Uses tag overlap (2 points per shared tag) and category match (1 point) to score relatedness. Only returns published posts.
- **View tracking**: Lightweight POST endpoint for client-side analytics. Does not affect `updatedAt`.
- **Duplicate**: Creates a draft copy with `(Copy)` title suffix and unique slug. Resets views, featured flag, and publish dates.
