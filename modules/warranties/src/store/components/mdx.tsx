import type { MDXComponents } from "mdx/types";
import { ClaimForm } from "./claim-form";
import { WarrantyStatus } from "./warranty-status";

export { ClaimForm, WarrantyStatus };

export default {
	ClaimForm,
	WarrantyStatus,
} satisfies MDXComponents;
