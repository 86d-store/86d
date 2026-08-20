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

# Pages Module

📚 **Documentation:** [86d.app/docs/modules/pages](https://86d.app/docs/modules/pages)

CMS-style static pages with a draft/published/archived workflow. Supports hierarchical page structure, SEO metadata, featured images, and optional inclusion in store navigation.

## Installation

```sh
npm install @86d-app/pages
```

## Usage

```ts
import pages from "@86d-app/pages";

const module = pages({
  pagesPerPage: "50",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `pagesPerPage` | `string` | `"50"` | Default number of pages per listing page |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/pages` | List published pages (paginated) |
| `GET` | `/pages/navigation` | Get pages marked for navigation |
| `GET` | `/pages/:slug` | Get a published page by slug |

## Store Pages

| Path | Component | Description |
|---|---|---|
| `/pages` | `PageListing` | Page listing view |
| `/p/:slug` | `PageDetail` | Single page detail view |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/pages` | List all pages (any status) |
| `POST` | `/admin/pages/create` | Create a new page |
| `GET` | `/admin/pages/:id` | Get a page by ID |
| `PUT` | `/admin/pages/:id/update` | Update a page |
| `DELETE` | `/admin/pages/:id/delete` | Delete a page |

## Controller API

The `PagesController` interface is exported for inter-module use.

```ts
interface PagesController {
  createPage(params: CreatePageParams): Promise<Page>;
  updatePage(id: string, params: UpdatePageParams): Promise<Page | null>;
  deletePage(id: string): Promise<boolean>;
  getPage(id: string): Promise<Page | null>;
  getPageBySlug(slug: string): Promise<Page | null>;

  publishPage(id: string): Promise<Page | null>;
  unpublishPage(id: string): Promise<Page | null>;
  archivePage(id: string): Promise<Page | null>;

  listPages(params?: {
    status?: PageStatus;
    showInNavigation?: boolean;
    parentId?: string | null;
    take?: number;
    skip?: number;
  }): Promise<Page[]>;

  getNavigationPages(): Promise<Page[]>;
}
```

## Types

```ts
type PageStatus = "draft" | "published" | "archived";

interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: PageStatus;
  template?: string;
  metaTitle?: string;
  metaDescription?: string;
  featuredImage?: string;
  position: number;
  showInNavigation: boolean;
  parentId?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Store Components

### Store Components

#### PageListing
Displays a list of published content pages with titles and excerpts. Links to individual page detail views.

**Props:**
- `limit` (number, optional) — Max pages to display. Default: 50.

#### PageDetail
Renders a single content page by slug. Shows title, excerpt, featured image, and full content.

**Props:**
- `slug` (string, required) — Page slug to display.

### Admin Components

#### PagesAdmin
Full admin interface for managing content pages. Includes:
- Paginated table with status, navigation flag, position, and last-updated columns
- Status filtering (draft/published/archived)
- Create/edit form with SEO metadata fields (meta title, meta description)
- Navigation toggle and position ordering
- Delete confirmation modal

## Notes

- Pages support hierarchical structure via `parentId`. Deleting a parent sets children's `parentId` to null (does not cascade).
- Publishing a page sets `publishedAt` to the current date; unpublishing reverts status to `draft`.
- The `/pages/navigation` store endpoint returns only published pages with `showInNavigation: true`.
- Each page can specify SEO fields (`metaTitle`, `metaDescription`) and an optional `template` name for custom rendering.
