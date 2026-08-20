# Social Sharing Module

Track and generate share links for products, collections, pages, and blog posts across social networks.

## Structure

```
src/
  index.ts              Factory: socialSharing(options?) => Module + admin nav (Marketing)
  schema.ts             Zod models: shareEvent, shareSettings
  service.ts            SocialSharingController interface
  service-impl.ts       SocialSharingController implementation
  mdx.d.ts              MDX type declarations
  store/endpoints/      share, count, url
  store/components/     ShareButtons (social share button row with counts)
  admin/endpoints/      list-shares, stats, top, get-settings, update-settings
  admin/components/     SocialSharingAdmin (stats, top content, events list, settings)
  __tests__/            controllers (40), endpoint-security (16), events (8)
```

## Options

```ts
interface SocialSharingOptions extends ModuleConfig {
  enabledNetworks?: string;   // comma-separated, default: all
  defaultHashtags?: string;   // comma-separated
}
```

## Data models

- **ShareEvent** — id, targetType (product|collection|page|blog-post|custom), targetId, network (twitter|facebook|pinterest|linkedin|whatsapp|email|copy-link), url, referrer, sessionId, createdAt
- **ShareSettings** — id (singleton "global"), enabledNetworks[], defaultMessage, hashtags[], customTemplates{}, updatedAt

## Patterns

- Settings use singleton ID "global" for single-row storage
- `generateShareUrl` is synchronous -- builds platform-specific share URLs with encoded params
- `getTopShared` aggregates share counts by targetType+targetId, sorted descending
- `getShareCountByNetwork` returns `Record<string, number>` breakdown
- Events: share.created, share.clicked, share.settings.updated
- Exports: shareEventNetwork, shareEventTargetType
