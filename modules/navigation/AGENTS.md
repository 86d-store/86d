# Navigation Module

Manages store navigation menus (header, footer, sidebar, mobile) with nested menu items supporting links, categories, collections, pages, and products.

## Structure

```
src/
  index.ts          Factory: navigation(options?) => Module
  schema.ts         Zod models: menu, menuItem
  service.ts        NavigationController interface + types
  service-impl.ts   NavigationController implementation
  markdown.ts       Markdown renderers for store pages
  admin/
    components/
      index.tsx             Admin component exports
      navigation-admin.tsx  Menu manager UI (.tsx logic)
      navigation-admin.mdx  Admin template
    endpoints/
      index.ts              Endpoint map
      create-menu.ts        POST /admin/navigation/menus/create
      list-menus.ts         GET  /admin/navigation/menus
      get-menu.ts           GET  /admin/navigation/menus/:id
      update-menu.ts        PUT  /admin/navigation/menus/:id/update
      delete-menu.ts        DELETE /admin/navigation/menus/:id/delete
      create-item.ts        POST /admin/navigation/items/create
      update-item.ts        PUT  /admin/navigation/items/:id/update
      delete-item.ts        DELETE /admin/navigation/items/:id/delete
      reorder-items.ts      POST /admin/navigation/menus/:menuId/reorder
  store/
    components/
      _hooks.ts             Client-side hooks
      index.tsx             Store component exports
      nav-menu.tsx          Header nav (.tsx logic)
      nav-menu.mdx          Header nav template
      nav-footer.tsx        Footer nav (.tsx logic)
      nav-footer.mdx        Footer nav template
      nav-mobile-menu.tsx   Mobile nav (.tsx logic)
      nav-mobile-menu.mdx   Mobile nav template
    endpoints/
      index.ts              Endpoint map
      list-menus.ts         GET  /navigation
      get-menu.ts           GET  /navigation/:slug
      get-by-location.ts    GET  /navigation/location/:location
```

## Options

```ts
NavigationOptions {
  maxDepth?: number  // max nesting depth, default 3
}
```

## Data models

- **menu**: id, name, slug (unique), location (header|footer|sidebar|mobile|custom), isActive, metadata
- **menuItem**: id, menuId (FK cascade), parentId (FK cascade, self-ref), label, type (link|category|collection|page|product), url, resourceId, openInNewTab, cssClass, position, isVisible, metadata

## Patterns

- Menu items form a tree via `parentId` self-reference; `MenuItemTree` recursively nests children
- `getMenuByLocation(location)` returns the active menu for a slot with items pre-resolved as a tree
- `MenuWithItems` combines a menu with its nested `MenuItemTree[]`
- Reorder endpoint accepts an ordered array of item IDs to set positions in bulk
- Item `type` determines whether `url` (for links) or `resourceId` (for category/collection/page/product) is used

## Events

| Event | Trigger | Payload |
|---|---|---|
| `menu.created` | Menu created via admin endpoint | `menuId`, `name`, `slug`, `location` |
| `menu.updated` | Menu updated via admin endpoint | `menuId`, `name`, `slug`, `location` |
| `menu.deleted` | Menu deleted via admin endpoint | `menuId` |
