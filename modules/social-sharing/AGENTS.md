# Social Sharing Module

Track and generate share links for products, collections, pages, and blog posts across social networks.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

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
