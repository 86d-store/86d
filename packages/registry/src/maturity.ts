import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/**
 * Maturity levels, ordered from most to least restrictive enablement.
 * These mirror the Store Runtime capability maturity model.
 */
export const MATURITY_LEVELS = [
	"stable",
	"beta",
	"experimental",
	"deprecated",
] as const;

export type ModuleMaturity = (typeof MATURITY_LEVELS)[number];

/**
 * The level a Module has when it records no evidence.
 *
 * Absence of evidence is not evidence of maturity: a Module that has never
 * recorded a test run or a production smoke requires explicit advanced opt-in.
 * Package presence, file count, and a clean build establish nothing.
 */
export const DEFAULT_MATURITY: ModuleMaturity = "experimental";

/** One piece of recorded evidence backing a maturity claim. */
export const maturityEvidenceSchema = z.object({
	/** What was checked, e.g. "contract", "failure-behavior", "production-smoke". */
	kind: z.string().min(1).max(100),
	/** Where the result can be inspected: a test path, a run URL, a register entry. */
	reference: z.string().min(1).max(500),
	/** ISO 8601 date the evidence was recorded. */
	recordedAt: z.string().min(4).max(40),
	/** The capability version the evidence covers. */
	version: z.string().min(1).max(50).optional(),
});

export type MaturityEvidence = z.infer<typeof maturityEvidenceSchema>;

export const maturityRecordSchema = z.object({
	maturity: z.enum(MATURITY_LEVELS),
	/** Evidence entries backing the claim. */
	evidence: z.array(maturityEvidenceSchema).default([]),
	/** Optional note for a Deprecated transition path. */
	transition: z.string().max(500).optional(),
});

export type MaturityRecord = z.infer<typeof maturityRecordSchema>;

export const MATURITY_FILE = "maturity.json";

/**
 * Evidence a level requires before the registry will publish it.
 *
 * Stable and Beta are claims about verified behavior, so they need recorded
 * evidence. Experimental and Deprecated are claims about *not* being ready,
 * which need no proof.
 */
const REQUIRED_EVIDENCE: Record<ModuleMaturity, number> = {
	stable: 1,
	beta: 1,
	experimental: 0,
	deprecated: 0,
};

export interface ResolvedMaturity {
	maturity: ModuleMaturity;
	evidence: MaturityEvidence[];
	/** Why the published level differs from the claimed one, when it does. */
	downgradedFrom?: ModuleMaturity;
	downgradeReason?: string;
}

/**
 * Resolve the maturity the registry will publish for a Module.
 *
 * The claim comes from the Module's own `maturity.json`. It is never inferred
 * from source shape, admin pages, endpoint count, or the existence of the
 * package. A claim the evidence does not support is downgraded rather than
 * rejected, so a Module stays installable under an honest level.
 */
export function resolveModuleMaturity(modulePath: string): ResolvedMaturity {
	const recordPath = join(modulePath, MATURITY_FILE);
	if (!existsSync(recordPath)) {
		return { maturity: DEFAULT_MATURITY, evidence: [] };
	}

	let parsed: MaturityRecord;
	try {
		parsed = maturityRecordSchema.parse(
			JSON.parse(readFileSync(recordPath, "utf-8")),
		);
	} catch {
		return {
			maturity: DEFAULT_MATURITY,
			evidence: [],
			downgradeReason: `${MATURITY_FILE} is unreadable or does not match the maturity contract.`,
		};
	}

	const required = REQUIRED_EVIDENCE[parsed.maturity];
	if (parsed.evidence.length < required) {
		return {
			maturity: DEFAULT_MATURITY,
			evidence: parsed.evidence,
			downgradedFrom: parsed.maturity,
			downgradeReason: `"${parsed.maturity}" requires at least ${required} recorded evidence entr${required === 1 ? "y" : "ies"}; ${parsed.evidence.length} recorded.`,
		};
	}

	return { maturity: parsed.maturity, evidence: parsed.evidence };
}
