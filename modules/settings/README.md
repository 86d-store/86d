<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

📚 **Documentation:** [86d.app/docs/modules/settings](https://86d.app/docs/modules/settings)

# Settings Module

Settings is the Store Runtime authority for shopper-visible presentation. It
provides the typed `settings.presentation.resolve@1.0.0` decision so consumers
such as invoice projection do not accept browser- or admin-supplied branding.

Global key-value store for store configuration. Settings are organized into groups (general, contact, social, legal, commerce, appearance) and managed through dedicated admin sub-pages.

## Installation

```sh
npm install @86d-app/settings
```

## Usage

```ts
import settings from "@86d-app/settings";

const module = settings({
  defaultStoreName: "My Store",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultStoreName` | `string` | — | Fallback store name shown before settings are configured |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/settings` | Get all public settings as a flat key-value map |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/settings` | Get all settings (grouped) |
| `POST` | `/admin/settings/update` | Update a single setting |
| `POST` | `/admin/settings/update-bulk` | Update multiple settings at once |
| `GET` | `/admin/settings/:key` | Get a single setting by key |
| `DELETE` | `/admin/settings/:key/delete` | Delete a setting |

## Setting Keys

The `SETTING_KEYS` constant is exported for type-safe key references:

| Group | Keys |
|---|---|
| General | `storeName`, `storeDescription`, `storeTagline`, `timezone`, `locale` |
| Contact | `supportEmail`, `supportPhone`, `businessAddress`, `businessCity`, `businessState`, `businessPostalCode`, `businessCountry` |
| Social | `facebook`, `instagram`, `twitter`, `tiktok`, `youtube`, `pinterest` |
| Legal | `returnPolicy`, `privacyPolicy`, `termsOfService`, `shippingPolicy` |
| Commerce | `currency`, `weightUnit`, `dimensionUnit`, `orderPrefix`, `taxIncluded` |
| Appearance | `logoUrl`, `faviconUrl`, `brandColor`, `announcementBar`, `announcementBarEnabled` |

```ts
import { SETTING_KEYS } from "@86d-app/settings";

// SETTING_KEYS.storeName === "general.store_name"
// SETTING_KEYS.currency === "commerce.currency"
```

## Controller API

The `SettingsController` interface is exported for inter-module use.

```ts
interface SettingsController {
  get(key: string): Promise<StoreSetting | null>;
  getValue(key: string): Promise<string | null>;
  set(key: string, value: string, group?: SettingGroup): Promise<StoreSetting>;
  setBulk(settings: Array<{ key: string; value: string; group?: SettingGroup }>): Promise<StoreSetting[]>;
  getByGroup(group: SettingGroup): Promise<StoreSetting[]>;
  getAll(): Promise<StoreSetting[]>;
  getPublic(): Promise<Record<string, string>>;
  delete(key: string): Promise<boolean>;
}
```

## Types

```ts
type SettingGroup = "general" | "contact" | "social" | "legal" | "commerce" | "appearance";

interface StoreSetting {
  id: string;
  key: string;
  value: string;
  group: SettingGroup;
  updatedAt: Date;
}
```

## Notes

- All setting values are stored as strings. Consumers must parse boolean/number values as needed (e.g., `taxIncluded` is `"true"` or `"false"`).
- The store endpoint (`GET /settings`) returns a flat `Record<string, string>` of all settings for client-side consumption.
- `setBulk` updates multiple settings atomically in a single call.
- The admin UI has five sub-pages (general, contact, social, legal, commerce) but only the main "Settings" entry appears in the sidebar navigation.
