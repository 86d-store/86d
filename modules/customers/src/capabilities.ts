import { provideCapability } from "@86d-app/core/capabilities";
import {
	customerContactResolveCapability,
	customerIdentityResolveCapability,
} from "@86d-app/core/commerce-capabilities";
import { createStoreCustomerIdentityService } from "./identity-binding";
import { createCustomerController } from "./service-impl";

export { customerContactResolveCapability, customerIdentityResolveCapability };

function contactLookupFailure(code: "customer_not_found" | "lookup_failed"): {
	ok: false;
	failure: { code: "customer_not_found" | "lookup_failed" };
} {
	return { ok: false, failure: { code } };
}

export const customerContactResolveProvider = provideCapability(
	customerContactResolveCapability,
	async (ctx, request) => {
		try {
			const customer = await createCustomerController(
				ctx.data,
				ctx.events,
			).getById(request.customerId);
			if (!customer) {
				return contactLookupFailure("customer_not_found");
			}
			return {
				ok: true,
				decision: {
					email: customer.email,
					firstName: customer.firstName,
					lastName: customer.lastName,
					...(customer.phone ? { phone: customer.phone } : {}),
				},
			};
		} catch {
			return contactLookupFailure("lookup_failed");
		}
	},
);

export const customerIdentityResolveProvider = provideCapability(
	customerIdentityResolveCapability,
	async (ctx, request) => {
		const result = await createStoreCustomerIdentityService(
			ctx.transactions,
		).resolveOrCreate(request);
		if (!result.ok) {
			return {
				ok: false,
				failure: { code: result.code, message: result.message },
			};
		}
		return {
			ok: true,
			decision: {
				customerId: result.customer.id,
				bindingId: result.binding.id,
				verifiedEmail: result.binding.verifiedEmail,
				createdCustomer: result.createdCustomer,
				createdBinding: result.createdBinding,
				boundAt: result.binding.boundAt.toISOString(),
			},
		};
	},
);
