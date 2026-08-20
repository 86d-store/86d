<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">Dynamic Commerce</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# Social Sharing Module

📚 **Documentation:** [86d.app/docs/modules/social-sharing](https://86d.app/docs/modules/social-sharing)

Track share events and generate platform-specific share URLs for products, collections, pages, and blog posts across Twitter, Facebook, Pinterest, LinkedIn, WhatsApp, email, and copy-link.

## Installation

```sh
npm install @86d-app/social-sharing
```

## Usage

```ts
import socialSharing from "@86d-app/social-sharing";

const module = socialSharing({
  enabledNetworks: "twitter,facebook,pinterest",
  defaultHashtags: "shop,deals",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabledNetworks` | `string` | all networks | Comma-separated list of enabled networks |
| `defaultHashtags` | `string` | none | Comma-separated default hashtags for shares |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/social-sharing/share` | Record a share event |
| GET | `/social-sharing/count` | Get share count for a target |
| GET | `/social-sharing/url` | Generate a share URL |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/social-sharing` | List share events |
| GET | `/admin/social-sharing/stats` | Share statistics |
| GET | `/admin/social-sharing/top` | Top shared content |
| GET | `/admin/social-sharing/settings` | Get share settings |
| POST | `/admin/social-sharing/settings/update` | Update share settings |

## Controller API

```ts
interface SocialSharingController extends ModuleController {
  recordShare(params: { targetType: TargetType; targetId: string; network: Network; url: string; ... }): Promise<ShareEvent>;
  getShareCount(targetType: TargetType, targetId: string): Promise<number>;
  getShareCountByNetwork(targetType: TargetType, targetId: string): Promise<Record<string, number>>;
  listShares(params?: { targetType?: TargetType; network?: Network; ... }): Promise<ShareEvent[]>;
  getTopShared(params?: { targetType?: TargetType; take?: number }): Promise<Array<{ targetType: string; targetId: string; count: number }>>;
  getSettings(): Promise<ShareSettings | null>;
  updateSettings(params: { enabledNetworks?: Network[]; defaultMessage?: string; hashtags?: string[]; customTemplates?: Record<string, string> }): Promise<ShareSettings>;
  generateShareUrl(network: Network, targetUrl: string, message?: string, hashtags?: string[]): string;
}
```

## Types

- **TargetType** — `"product" | "collection" | "page" | "blog-post" | "custom"`
- **Network** — `"twitter" | "facebook" | "pinterest" | "linkedin" | "whatsapp" | "email" | "copy-link"`
- **ShareEvent** — Individual share tracking record with network and referrer
- **ShareSettings** — Global settings for enabled networks, default message, hashtags, and per-network templates

## Components

### Store

- **ShareButtons** — Social share button row for any target. Renders buttons for Twitter, Facebook, Pinterest, LinkedIn, WhatsApp, Email, and Copy Link. Records share events and shows total count. Requires `targetType`, `targetId`, `url` props.

### Admin

- **SocialSharingAdmin** — Admin dashboard with share stats by network, top shared content, recent events table (filterable by target type and network), and settings panel (enabled networks, default message, hashtags).

## Notes

- `generateShareUrl` is a synchronous method that builds platform-specific URLs (e.g., `https://twitter.com/intent/tweet?url=...`).
- Settings use a singleton record with ID `"global"`. First call to `getSettings` may return null if not yet configured.
- `getTopShared` aggregates all share events in memory and sorts by count. For large datasets, consider pagination.
- `copy-link` network returns the raw target URL from `generateShareUrl`.
