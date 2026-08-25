import { describe, expect, it } from "vitest";
import {
	formatLegalPolicyRevisionDate,
	legalPolicyRevisionDates,
} from "../(insecure)/legal-policy-dates";

describe("legal policy revision dates", () => {
	it("keeps each content revision as an immutable ISO date", () => {
		expect(legalPolicyRevisionDates).toEqual({
			privacy: "2026-08-25",
			terms: "2026-08-25",
		});
	});

	it("formats revision dates consistently for store policy pages", () => {
		expect(
			formatLegalPolicyRevisionDate(legalPolicyRevisionDates.privacy),
		).toBe("August 25, 2026");
		expect(formatLegalPolicyRevisionDate(legalPolicyRevisionDates.terms)).toBe(
			"August 25, 2026",
		);
	});
});
