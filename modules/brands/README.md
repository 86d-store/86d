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

# Brands Module

📚 **Documentation:** [86d.app/docs/modules/brands](https://86d.app/docs/modules/brands)

Product brand management module. Organize products by manufacturer or brand with dedicated brand pages, featured brand listings, and full SEO support.

## Installation

```sh
npm install @86d-app/brands
```

## Usage

```ts
import brands from "@86d-app/brands";

const module = brands({
  maxProductsPerPage: "100",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxProductsPerPage` | `string` | `"100"` | Maximum products returned per brand page listing |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/brands` | List active brands (paginated, filterable by featured) |
| `GET` | `/brands/featured` | Get featured brands with optional limit |
| `GET` | `/brands/:slug` | Get a single brand by slug |
| `GET` | `/brands/:slug/products` | Get products for a brand (paginated) |
| `GET` | `/brands/product/:productId` | Get the brand for a specific product |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/brands` | List all brands (paginated, filterable) |
| `GET` | `/admin/brands/stats` | Get brand statistics |
| `POST` | `/admin/brands/create` | Create a new brand |
| `POST` | `/admin/brands/:id/update` | Update a brand |
| `POST` | `/admin/brands/:id/delete` | Delete a brand and all product links |
| `GET` | `/admin/brands/:id/products` | List products for a brand |
| `POST` | `/admin/brands/:id/products/assign` | Assign products to a brand |
| `POST` | `/admin/brands/:id/products/unassign` | Unassign products from a brand |

## Controller API

The `BrandController` interface is exported for use in inter-module contracts.

```ts
interface BrandController {
  createBrand(params: {
    name: string;
    slug: string;
    description?: string;
    logo?: string;
    bannerImage?: string;
    website?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    position?: number;
    seoTitle?: string;
    seoDescription?: string;
  }): Promise<Brand>;

  getBrand(id: string): Promise<Brand | null>;
  getBrandBySlug(slug: string): Promise<Brand | null>;
  updateBrand(id: string, params: { ... }): Promise<Brand | null>;
  deleteBrand(id: string): Promise<boolean>;
  listBrands(params?: { isActive?: boolean; isFeatured?: boolean; take?: number; skip?: number }): Promise<Brand[]>;
  countBrands(params?: { isActive?: boolean; isFeatured?: boolean }): Promise<number>;

  assignProduct(params: { brandId: string; productId: string }): Promise<BrandProduct>;
  unassignProduct(params: { brandId: string; productId: string }): Promise<boolean>;
  getBrandProducts(params: { brandId: string; take?: number; skip?: number }): Promise<BrandProduct[]>;
  countBrandProducts(brandId: string): Promise<number>;
  getBrandForProduct(productId: string): Promise<Brand | null>;

  bulkAssignProducts(params: { brandId: string; productIds: string[] }): Promise<number>;
  bulkUnassignProducts(params: { brandId: string; productIds: string[] }): Promise<number>;
  getFeaturedBrands(limit?: number): Promise<Brand[]>;
  getStats(): Promise<BrandStats>;
}
```

## Types

```ts
interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  bannerImage?: string;
  website?: string;
  isActive: boolean;
  isFeatured: boolean;
  position: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BrandProduct {
  id: string;
  brandId: string;
  productId: string;
  assignedAt: Date;
}

interface BrandStats {
  totalBrands: number;
  activeBrands: number;
  featuredBrands: number;
  totalProducts: number;
}
```

## Notes

- A product can belong to only one brand. Assigning a product to a new brand automatically removes it from the previous brand.
- Store endpoints only return active brands. Inactive brands are hidden from the storefront.
- Deleting a brand cascades to remove all associated product links.
- Bulk assign/unassign operations are idempotent — already-assigned products are skipped.
