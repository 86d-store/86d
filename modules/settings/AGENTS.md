# Settings Module

Settings owns shopper-visible Store presentation. The typed
`settings.presentation.resolve@1.0.0` capability exposes validated name,
description, support email, and currency decisions without giving consumers
Settings data access. Missing or malformed required presentation fails closed.

Key-value store for global store configuration organized by group (general, contact, social, legal, commerce, appearance).

## Structure

```
src/
  index.ts          Factory: settings(options?) => Module
  schema.ts         Zod models: storeSetting
  service.ts        SettingsController interface + types + SETTING_KEYS constant
  service-impl.ts   SettingsController implementation
  admin/
    components/
      index.tsx               Admin component exports
      settings-general.tsx    General settings form (.tsx logic)
      settings-general.mdx    Admin template
      settings-contact.tsx    Contact settings form (.tsx logic)
      settings-contact.mdx    Admin template
      settings-social.tsx     Social links form (.tsx logic)
      settings-social.mdx     Admin template
      settings-legal.tsx      Legal pages form (.tsx logic)
      settings-legal.mdx      Admin template
      settings-commerce.tsx   Commerce settings form (.tsx logic)
      settings-commerce.mdx   Admin template
    endpoints/
      index.ts              Endpoint map
      get-settings.ts       GET  /admin/settings
      get-setting.ts        GET  /admin/settings/:key
      update-setting.ts     POST /admin/settings/update
      update-bulk.ts        POST /admin/settings/update-bulk
      delete-setting.ts     DELETE /admin/settings/:key/delete
  store/
    endpoints/
      index.ts              Endpoint map
      get-public-settings.ts GET  /settings
```

## Options

```ts
SettingsOptions {
  defaultStoreName?: string  // fallback store name before settings are configured
}
```

## Data models

- **storeSetting**: id, key (unique), value (string), group (general|contact|social|legal|commerce|appearance), updatedAt

## Key constants

`SETTING_KEYS` maps friendly names to dotted keys:
- General: storeName, storeDescription, storeTagline, timezone, locale
- Contact: supportEmail, supportPhone, businessAddress, businessCity, businessState, businessPostalCode, businessCountry
- Social: facebook, instagram, twitter, tiktok, youtube, pinterest
- Legal: returnPolicy, privacyPolicy, termsOfService, shippingPolicy
- Commerce: currency, weightUnit, dimensionUnit, orderPrefix, taxIncluded
- Appearance: logoUrl, faviconUrl, brandColor, announcementBar, announcementBarEnabled

## Patterns

- All values stored as strings regardless of actual type — consumers must parse as needed
- `getPublic()` returns a flat `Record<string, string>` of all settings (used by store endpoint)
- `setBulk` accepts an array of `{ key, value, group? }` for atomic multi-setting updates
- Admin has 5 sub-pages (general, contact, social, legal, commerce) — only general shows in sidebar nav
- No store components — store only has a single read endpoint for public settings
- `SETTING_KEYS` constant is exported from the module for type-safe key references
