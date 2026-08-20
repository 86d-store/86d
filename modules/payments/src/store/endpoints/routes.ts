import {
	deletePaymentMethodUnavailable as deletePaymentMethod,
	listPaymentMethodsUnavailable as listPaymentMethods,
} from "./activation-unavailable";
import { prepareManagedPaymentUnavailable } from "./prepare-managed-payment";

export const storeEndpoints = {
	"/payments/methods": listPaymentMethods,
	"/payments/methods/:id": deletePaymentMethod,
	"/payments/managed/prepare": prepareManagedPaymentUnavailable,
};
