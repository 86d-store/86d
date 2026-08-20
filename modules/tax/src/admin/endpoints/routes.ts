import { adminCreateCategory } from "./create-category";
import { adminCreateExemption } from "./create-exemption";
import { adminCreateNexus } from "./create-nexus";
import { adminCreateRate } from "./create-rate";
import { adminDeleteCategory } from "./delete-category";
import { adminDeleteExemption } from "./delete-exemption";
import { adminDeleteNexus } from "./delete-nexus";
import { adminDeleteRate } from "./delete-rate";
import { adminGetRate } from "./get-rate";
import { adminGetReport } from "./get-report";
import type { createGetSettingsEndpoint } from "./get-settings";
import { adminLinkTransaction } from "./link-transaction";
import { adminListCategories } from "./list-categories";
import { adminListExemptions } from "./list-exemptions";
import { adminListNexus } from "./list-nexus";
import { adminListRates } from "./list-rates";
import { adminListTransactions } from "./list-transactions";
import {
	adminCreateTaxPolicyV2,
	adminCreateTaxRatePackV2,
	adminDisableTaxPolicyV2,
	adminListTaxPoliciesV2,
	adminListTaxRatePacksV2,
} from "./policy-v2";
import { adminUpdateRate } from "./update-rate";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/tax/settings": settingsEndpoint,
	};
}

const adminEndpoints = {
	"/admin/tax/rates": adminListRates,
	"/admin/tax/rates/create": adminCreateRate,
	"/admin/tax/rates/:id": adminGetRate,
	"/admin/tax/rates/:id/update": adminUpdateRate,
	"/admin/tax/rates/:id/delete": adminDeleteRate,
	"/admin/tax/categories": adminListCategories,
	"/admin/tax/categories/create": adminCreateCategory,
	"/admin/tax/categories/:id/delete": adminDeleteCategory,
	"/admin/tax/exemptions": adminListExemptions,
	"/admin/tax/exemptions/create": adminCreateExemption,
	"/admin/tax/exemptions/:id/delete": adminDeleteExemption,
	"/admin/tax/nexus": adminListNexus,
	"/admin/tax/nexus/create": adminCreateNexus,
	"/admin/tax/nexus/:id/delete": adminDeleteNexus,
	"/admin/tax/transactions": adminListTransactions,
	"/admin/tax/transactions/:id/link": adminLinkTransaction,
	"/admin/tax/report": adminGetReport,
	"/admin/tax/v2/rate-packs": adminListTaxRatePacksV2,
	"/admin/tax/v2/rate-packs/create": adminCreateTaxRatePackV2,
	"/admin/tax/v2/policies": adminListTaxPoliciesV2,
	"/admin/tax/v2/policies/create": adminCreateTaxPolicyV2,
	"/admin/tax/v2/policies/:id/disable": adminDisableTaxPolicyV2,
};
