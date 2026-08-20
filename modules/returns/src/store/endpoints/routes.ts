import {
	getReturnStatusUnavailable as getReturnStatus,
	listCustomerReturnsUnavailable as listCustomerReturns,
} from "./customer-continuity-unavailable";

export const storeEndpoints = {
	"/returns": listCustomerReturns,
	"/returns/:id": getReturnStatus,
};
