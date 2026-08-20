import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
	acceptCapability,
	type CapabilityDecision,
	type CapabilityFailure,
	type CapabilityRequest,
	defineCapability,
	provideCapability,
} from "../capabilities";

const availability = defineCapability({
	name: "inventory.availability",
	version: "1.0.0",
	owner: "inventory",
	request: z.object({ sku: z.string().min(1) }).strict(),
	decision: z.object({ available: z.boolean() }).strict(),
	failure: z
		.object({
			code: z.literal("inventory_unavailable"),
			message: z.string(),
		})
		.strict(),
});

describe("typed capability contracts", () => {
	it("preserves request, decision, and failure inference", () => {
		expectTypeOf<CapabilityRequest<typeof availability>>().toEqualTypeOf<{
			sku: string;
		}>();
		expectTypeOf<CapabilityDecision<typeof availability>>().toEqualTypeOf<{
			available: boolean;
		}>();
		expectTypeOf<CapabilityFailure<typeof availability>>().toEqualTypeOf<{
			code: "inventory_unavailable";
			message: string;
		}>();
	});

	it("keeps owner and version as literal metadata", () => {
		expect(availability.name).toBe("inventory.availability");
		expect(availability.version).toBe("1.0.0");
		expect(availability.owner).toBe("inventory");
	});

	it("types provider handlers and accepted versions from the definition", () => {
		const provider = provideCapability(availability, async (_ctx, request) => ({
			ok: true,
			decision: { available: request.sku === "sku-1" },
		}));
		const acceptance = acceptCapability(availability, {
			versions: ["1.0.0"],
			optional: true,
		});

		expect(provider.definition).toBe(availability);
		expect(acceptance).toEqual({
			name: "inventory.availability",
			owner: "inventory",
			versions: ["1.0.0"],
			optional: true,
			definition: availability,
		});
	});
});
