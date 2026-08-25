export const legalPolicyRevisionDates = {
	privacy: "2026-08-25",
	terms: "2026-08-25",
} as const;

const legalPolicyDateFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "long",
	timeZone: "UTC",
	year: "numeric",
});

export function formatLegalPolicyRevisionDate(revisionDate: string): string {
	return legalPolicyDateFormatter.format(
		new Date(`${revisionDate}T00:00:00.000Z`),
	);
}
