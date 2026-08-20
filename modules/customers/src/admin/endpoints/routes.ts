import { adminBulkTags } from "./bulk-tags";
import { adminCreateAddress } from "./create-address";
import { adminDeleteAddress } from "./delete-address";
import { adminDeleteCustomer } from "./delete-customer";
import { adminExportCustomers } from "./export-customers";
import { adminGetCustomer } from "./get-customer";
import { adminImportCustomers } from "./import-customers";
import { adminListCustomers } from "./list-customers";
import { adminListTags } from "./list-tags";
import { adminAddTags, adminRemoveTags } from "./manage-tags";
import { adminSetDefaultAddress } from "./set-default-address";
import { adminUpdateAddress } from "./update-address";
import { adminUpdateCustomer } from "./update-customer";

export const adminEndpoints = {
	"/admin/customers": adminListCustomers,
	"/admin/customers/export": adminExportCustomers,
	"/admin/customers/import": adminImportCustomers,
	"/admin/customers/tags": adminListTags,
	"/admin/customers/bulk-tags": adminBulkTags,
	"/admin/customers/:id": adminGetCustomer,
	"/admin/customers/:id/update": adminUpdateCustomer,
	"/admin/customers/:id/delete": adminDeleteCustomer,
	"/admin/customers/:id/addresses/create": adminCreateAddress,
	"/admin/customers/:id/addresses/:addressId/update": adminUpdateAddress,
	"/admin/customers/:id/addresses/:addressId/delete": adminDeleteAddress,
	"/admin/customers/:id/addresses/:addressId/set-default":
		adminSetDefaultAddress,
	"/admin/customers/:id/tags": adminAddTags,
	"/admin/customers/:id/tags/remove": adminRemoveTags,
};
