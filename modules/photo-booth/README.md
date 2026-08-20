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

# Photo Booth Module

📚 **Documentation:** [86d.app/docs/modules/photo-booth](https://86d.app/docs/modules/photo-booth)

Event photo capture with session management, live photo streams, and email/SMS delivery for in-store or event activations.

## Installation

```sh
npm install @86d-app/photo-booth
```

## Usage

```ts
import photoBooth from "@86d-app/photo-booth";

const module = photoBooth({
  maxPhotoSize: "5242880",
  allowedFormats: "jpeg,png,webp",
  streamEnabled: "true",
  requireEmail: "false",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxPhotoSize` | `string` | `"5242880"` | Max photo size in bytes (5MB) |
| `allowedFormats` | `string` | `"jpeg,png,webp"` | Comma-separated allowed formats |
| `streamEnabled` | `string` | `"true"` | Enable photo streaming |
| `requireEmail` | `string` | `"false"` | Require email for photo capture |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/photo-booth/capture` | Capture a photo |
| GET | `/photo-booth/stream/:id` | Get photos in a stream |
| POST | `/photo-booth/send` | Send photo via email/SMS |
| GET | `/photo-booth/photos` | List public photos |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/photo-booth/photos` | List all photos |
| POST | `/admin/photo-booth/photos/:id/delete` | Delete a photo |
| POST | `/admin/photo-booth/sessions/create` | Create a session |
| GET | `/admin/photo-booth/sessions` | List sessions |
| POST | `/admin/photo-booth/sessions/:id/end` | End a session |
| POST | `/admin/photo-booth/streams/create` | Create a stream |
| GET | `/admin/photo-booth/streams` | List streams |
| POST | `/admin/photo-booth/streams/:id/toggle` | Toggle stream live status |
| GET | `/admin/photo-booth/streams/:id/photos` | Get stream photos |

## Controller API

```ts
interface PhotoBoothController extends ModuleController {
  capturePhoto(params: { sessionId: string; imageUrl: string; ... }): Promise<Photo>;
  getPhoto(id: string): Promise<Photo | null>;
  deletePhoto(id: string): Promise<boolean>;
  listPhotos(params?: { sessionId?: string; isPublic?: boolean; ... }): Promise<Photo[]>;
  sendPhoto(id: string, params: { email?: string; phoneNumber?: string }): Promise<Photo | null>;
  createSession(params: { name: string; ... }): Promise<PhotoSession>;
  getSession(id: string): Promise<PhotoSession | null>;
  endSession(id: string): Promise<PhotoSession | null>;
  listSessions(params?: { take?: number; skip?: number }): Promise<PhotoSession[]>;
  createStream(params: { name: string; ... }): Promise<PhotoStream>;
  getStream(id: string): Promise<PhotoStream | null>;
  addToStream(streamId: string, photoId: string): Promise<boolean>;
  getStreamPhotos(streamId: string, params?: { ... }): Promise<Photo[]>;
  toggleStreamLive(id: string): Promise<PhotoStream | null>;
  listStreams(params?: { take?: number; skip?: number }): Promise<PhotoStream[]>;
}
```

## Types

- **SendStatus** — `"pending" | "sent" | "failed" | "none"`
- **Photo** — Captured photo with session reference, delivery status, and tags
- **PhotoSession** — Named session grouping photos with start/end lifecycle
- **PhotoStream** — Live-togglable stream that aggregates photos for display

## Notes

- Photos are associated with streams via `metadata.streamId`, not a join table. Stream photo queries filter client-side.
- `sendPhoto` sets `sendStatus` to `"sent"` but does not perform actual delivery -- integrate with an email/SMS provider.
- Ending a session sets `isActive: false` and records `endedAt`. Already-ended sessions return null.
