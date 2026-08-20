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

# Navigation Module

📚 **Documentation:** [86d.app/docs/modules/navigation](https://86d.app/docs/modules/navigation)

Manages store navigation menus with nested, drag-and-drop-reorderable menu items. Supports multiple locations (header, footer, sidebar, mobile, custom) and item types including direct links, categories, collections, pages, and products.

## Installation

```sh
npm install @86d-app/navigation
```

## Usage

```ts
import navigation from "@86d-app/navigation";

const module = navigation({
  maxDepth: 3,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxDepth` | `number` | `3` | Maximum nesting depth for menu items |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/navigation` | List all active menus |
| `GET` | `/navigation/location/:location` | Get the active menu for a location (with nested items) |
| `GET` | `/navigation/:slug` | Get a menu by slug (with nested items) |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/navigation/menus` | List all menus |
| `POST` | `/admin/navigation/menus/create` | Create a new menu |
| `GET` | `/admin/navigation/menus/:id` | Get a menu with items |
| `PUT` | `/admin/navigation/menus/:id/update` | Update a menu |
| `DELETE` | `/admin/navigation/menus/:id/delete` | Delete a menu |
| `POST` | `/admin/navigation/menus/:menuId/reorder` | Reorder items within a menu |
| `POST` | `/admin/navigation/items/create` | Create a menu item |
| `PUT` | `/admin/navigation/items/:id/update` | Update a menu item |
| `DELETE` | `/admin/navigation/items/:id/delete` | Delete a menu item |

## Controller API

The `NavigationController` interface is exported for inter-module use.

```ts
interface NavigationController {
  createMenu(params: CreateMenuParams): Promise<Menu>;
  updateMenu(id: string, params: UpdateMenuParams): Promise<Menu | null>;
  deleteMenu(id: string): Promise<boolean>;
  getMenu(id: string): Promise<Menu | null>;
  getMenuBySlug(slug: string): Promise<Menu | null>;
  listMenus(params?: { location?: MenuLocation; isActive?: boolean }): Promise<Menu[]>;

  createItem(params: CreateMenuItemParams): Promise<MenuItem>;
  updateItem(id: string, params: UpdateMenuItemParams): Promise<MenuItem | null>;
  deleteItem(id: string): Promise<boolean>;
  getItem(id: string): Promise<MenuItem | null>;
  listItems(menuId: string, params?: { parentId?: string }): Promise<MenuItem[]>;

  getMenuWithItems(id: string): Promise<MenuWithItems | null>;
  getMenuByLocation(location: MenuLocation): Promise<MenuWithItems | null>;
  reorderItems(menuId: string, itemIds: string[], parentId?: string): Promise<void>;
}
```

## Types

```ts
type MenuLocation = "header" | "footer" | "sidebar" | "mobile" | "custom";
type MenuItemType = "link" | "category" | "collection" | "page" | "product";

interface Menu {
  id: string;
  name: string;
  slug: string;
  location: MenuLocation;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface MenuItem {
  id: string;
  menuId: string;
  parentId?: string;
  label: string;
  type: MenuItemType;
  url?: string;
  resourceId?: string;
  openInNewTab: boolean;
  cssClass?: string;
  position: number;
  isVisible: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface MenuItemTree extends MenuItem {
  children: MenuItemTree[];
}

interface MenuWithItems extends Menu {
  items: MenuItemTree[];
}
```

## Store Components

### NavFooter

Fetches and renders a footer navigation menu organized into columns, with each top-level item as a column heading and its children as links beneath.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `location` | `string` | No | Menu location identifier to fetch (defaults to `"footer"`) |

#### Usage in MDX

```mdx
<NavFooter />
```

Use this component in a site footer layout to render the store's footer navigation links.

### NavMenu

Fetches and renders a horizontal navigation menu with support for nested dropdown children, suitable for desktop site headers.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `location` | `string` | No | Menu location identifier to fetch (defaults to `"header"`) |

#### Usage in MDX

```mdx
<NavMenu />
```

Use this component in a site header to render the store's primary desktop navigation.

### NavMobileMenu

Fetches and renders a mobile-friendly navigation menu with hamburger toggle, expandable/collapsible sections, and overlay support.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `location` | `string` | No | Menu location identifier to fetch (defaults to `"mobile"`) |

#### Usage in MDX

```mdx
<NavMobileMenu />
```

Use this component in a mobile site header to provide a responsive hamburger navigation menu.

## Notes

- Menu items form a tree via `parentId` self-references. Deleting a parent cascades to its children.
- Item `type` determines whether `url` (for links) or `resourceId` (for category/collection/page/product references) is used.
- `getMenuByLocation` returns the first active menu for the given slot with items pre-resolved as a nested tree.
- The reorder endpoint accepts an ordered array of item IDs and updates their `position` fields in bulk.
