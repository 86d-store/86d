# Photo Booth Module

Event photo capture with sessions, live streams, and email/SMS delivery.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts          Factory: photoBooth(options?) => Module + admin nav (Marketing)
  schema.ts         Zod models: photo, photoSession, photoStream
  service.ts        PhotoBoothController interface
  service-impl.ts   PhotoBoothController implementation
  store/endpoints/  capture, stream/:id, send, photos
  admin/endpoints/  photos, sessions, streams (CRUD + toggle live)
  __tests__/        controllers (53), endpoint-security (20), events (13)
```

## Options

```ts
interface PhotoBoothOptions extends ModuleConfig {
  maxPhotoSize?: string;     // default: "5242880" (5MB)
  allowedFormats?: string;   // default: "jpeg,png,webp"
  streamEnabled?: string;    // default: "true"
  requireEmail?: string;     // default: "false"
}
```

## Data models

- **Photo** — id, sessionId, imageUrl, thumbnailUrl, caption, email, phoneNumber, sendStatus (pending|sent|failed|none), tags[], metadata, isPublic, createdAt
- **PhotoSession** — id, name, description, isActive, photoCount, startedAt, endedAt, settings, timestamps
- **PhotoStream** — id, name, isLive, photoCount, settings, timestamps

## Patterns

- Stream-photo association stored in photo.metadata.streamId (no join table)
- getStreamPhotos filters all photos client-side by metadata.streamId
- capturePhoto auto-increments session.photoCount
- addToStream auto-increments stream.photoCount
- Events: photo.captured, photo.sent, photo.deleted, stream.created, stream.ended, photo.shared
- Exports: photoImageUrl, photoSessionName
