# Photo Booth Module

Event photo capture with sessions, live streams, and email/SMS delivery.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

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
