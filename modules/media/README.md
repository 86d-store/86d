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

# Media Module

📚 **Documentation:** [86d.app/docs/modules/media](https://86d.app/docs/modules/media)

Digital asset management module with folder-based organization, tagging, bulk operations, and store-facing display components for images, galleries, and video.

## Installation

```sh
npm install @86d-app/media
```

## Usage

```ts
import media from "@86d-app/media";

const module = media({
  maxFileSize: "10485760", // 10MB in bytes
  allowedMimeTypes: "image/png,image/jpeg,image/webp,video/mp4",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxFileSize` | `string` | `"10485760"` | Maximum file size in bytes (10MB) |
| `allowedMimeTypes` | `string` | all | Comma-separated list of allowed MIME types |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/media` | List assets (filterable by folder, MIME type, tag) |
| `GET` | `/media/:id` | Get a single asset by ID |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/media` | List all assets (filterable by folder, MIME type, tag, search) |
| `POST` | `/admin/media/create` | Create a new asset record |
| `POST` | `/admin/media/bulk-delete` | Bulk-delete multiple assets |
| `POST` | `/admin/media/move` | Move assets to a different folder |
| `GET` | `/admin/media/stats` | Get media library statistics |
| `GET` | `/admin/media/folders` | List folders (filterable by parentId) |
| `POST` | `/admin/media/folders/create` | Create a new folder |
| `PUT` | `/admin/media/folders/:id` | Rename a folder |
| `DELETE` | `/admin/media/folders/:id/delete` | Delete a folder |
| `GET` | `/admin/media/:id` | Get an asset by ID |
| `PUT` | `/admin/media/:id/update` | Update asset metadata |
| `DELETE` | `/admin/media/:id/delete` | Delete an asset |

## Controller API

The `MediaController` interface is exported for inter-module use.

```ts
interface MediaController {
  createAsset(params: {
    name: string;
    url: string;
    mimeType: string;
    size: number;
    altText?: string;
    width?: number;
    height?: number;
    folder?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Asset>;

  getAsset(id: string): Promise<Asset | null>;

  updateAsset(id: string, params: {
    name?: string;
    altText?: string;
    url?: string;
    folder?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Asset | null>;

  deleteAsset(id: string): Promise<boolean>;

  listAssets(params?: {
    folder?: string;
    mimeType?: string;
    tag?: string;
    search?: string;
    take?: number;
    skip?: number;
  }): Promise<Asset[]>;

  bulkDelete(ids: string[]): Promise<number>;
  moveAssets(ids: string[], folder: string | null): Promise<number>;
  getStats(): Promise<MediaStats>;

  createFolder(params: { name: string; parentId?: string }): Promise<Folder>;
  getFolder(id: string): Promise<Folder | null>;
  listFolders(parentId?: string): Promise<Folder[]>;
  renameFolder(id: string, name: string): Promise<Folder | null>;
  deleteFolder(id: string): Promise<boolean>;
}
```

## Types

```ts
interface Asset {
  id: string;
  name: string;
  altText?: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  folder?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface Folder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: Date;
}

interface MediaStats {
  totalAssets: number;
  totalSize: number;
  byMimeType: Record<string, number>;
  byFolder: Record<string, number>;
}
```

## Store Components

### MediaGallery

Filterable grid of media assets. Images render as thumbnails, videos show poster frames with a play overlay, and other file types display a label. Supports pagination and item selection.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `folder` | `string` | No | Filter by folder ID |
| `type` | `string` | No | Filter by type: `"image"`, `"video"`, or a MIME prefix |
| `tag` | `string` | No | Filter by tag |
| `pageSize` | `number` | No | Items per page (default: 12) |

#### Usage in MDX

```mdx
<MediaGallery />
<MediaGallery type="image" pageSize={8} />
<MediaGallery folder="hero-banners" tag="featured" />
```

Use on gallery pages, lookbook sections, or anywhere a browsable media grid is needed.

### ImageDisplay

Displays a single image asset by ID. Fetches the asset, renders with proper alt text, and optionally shows a caption.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | Asset ID to display |
| `className` | `string` | No | CSS class for the container |
| `showCaption` | `boolean` | No | Show asset name as caption (default: false) |

#### Usage in MDX

```mdx
<ImageDisplay id="asset-123" />
<ImageDisplay id="asset-123" showCaption />
<ImageDisplay id="hero-banner" className="aspect-[21/9] w-full" />
```

Use for hero images, content blocks, or anywhere a single managed image is displayed.

### VideoPlayer

Embedded HTML5 video player. Fetches a video asset by ID and renders with native controls.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | Asset ID of the video |
| `autoPlay` | `boolean` | No | Auto-play muted when visible (default: false) |
| `loop` | `boolean` | No | Loop playback (default: false) |
| `className` | `string` | No | CSS class for the container |

#### Usage in MDX

```mdx
<VideoPlayer id="promo-video" />
<VideoPlayer id="product-demo" autoPlay loop />
<VideoPlayer id="tutorial" className="max-w-2xl mx-auto" />
```

Use for product demo videos, promotional content, or tutorial sections.

## Notes

- Folders support nesting via `parentId` for hierarchical organization.
- Tags are stored as a JSON string array and can be filtered one at a time via `listAssets({ tag })`.
- `bulkDelete` and `moveAssets` support batch operations on multiple asset IDs.
- `getStats()` provides aggregate totals broken down by MIME type and folder.
- Store endpoints are read-only; all create, update, and delete operations require admin access.
- Configuration values are strings for module config compatibility.
