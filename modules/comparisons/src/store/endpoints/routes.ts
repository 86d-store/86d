import { addProduct } from "./add-product";
import { clearComparison } from "./clear-comparison";
import { listComparison } from "./list-comparison";
import { mergeComparison } from "./merge-comparison";
import { removeProduct } from "./remove-product";

export const storeEndpoints = {
	"/comparisons": listComparison,
	"/comparisons/add": addProduct,
	"/comparisons/remove": removeProduct,
	"/comparisons/clear": clearComparison,
	"/comparisons/merge": mergeComparison,
};
