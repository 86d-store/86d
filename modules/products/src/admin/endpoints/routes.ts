import { bulkAction } from "./bulk-action";
import {
	createCatalogRevisionDraft,
	getCatalogRevision,
	listCatalogRevisions,
	publishCatalogRevision,
	reviewCatalogRevision,
} from "./catalog-revisions";
import { createCategory } from "./create-category";
import { createProduct } from "./create-product";
import { createVariant } from "./create-variant";
import { deleteCategory } from "./delete-category";
import { deleteProduct } from "./delete-product";
import { deleteVariant } from "./delete-variant";
import { adminGetProduct } from "./get-product";
import { importProducts } from "./import-products";
import { adminListCategories } from "./list-categories";
import { adminListCollections } from "./list-collections";
import { adminListProducts } from "./list-products";
import { updateCategory } from "./update-category";
import { updateProduct } from "./update-product";
import { updateVariant } from "./update-variant";

export const adminEndpoints = {
	"/admin/catalog/revisions/list": listCatalogRevisions,
	"/admin/catalog/revisions/create": createCatalogRevisionDraft,
	"/admin/catalog/revisions/:id": getCatalogRevision,
	"/admin/catalog/revisions/:id/review": reviewCatalogRevision,
	"/admin/catalog/revisions/:id/publish": publishCatalogRevision,
	"/admin/products/list": adminListProducts,
	"/admin/products/create": createProduct,
	"/admin/products/:id": adminGetProduct,
	"/admin/products/:id/update": updateProduct,
	"/admin/products/:id/delete": deleteProduct,
	"/admin/products/import": importProducts,
	"/admin/products/bulk": bulkAction,
	"/admin/products/:productId/variants": createVariant,
	"/admin/variants/:id/update": updateVariant,
	"/admin/variants/:id/delete": deleteVariant,
	"/admin/categories/list": adminListCategories,
	"/admin/categories/create": createCategory,
	"/admin/categories/:id/update": updateCategory,
	"/admin/categories/:id/delete": deleteCategory,
	"/admin/products/collections/list": adminListCollections,
};
