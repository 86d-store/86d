import { createHash } from "node:crypto";
import {
	COMMAND_TRANSITIONS,
	canonicalJson,
	commandFailureCodeSchema,
	type JsonValue,
	NORMALIZED_FAILURE_CATALOG,
	normalizedFailure,
	WORKFLOW_TRANSITIONS,
} from "./command";
import { conformanceArtifact as artifact } from "./generated/conformance-artifact";

export const CONTRACTS_PACKAGE_VERSION = "0.0.42" as const;
export const CONTRACTS_ARTIFACT_VERSION = artifact.version;
export const CONFORMANCE_DIGEST = artifact.digest;
export const COMPATIBILITY_MATRIX = artifact.compatibilityMatrix;
export const PREVIOUS_MINOR_FIXTURE_SUITE = artifact.previousMinorFixtureSuite;
export const CURRENT_FIXTURE_SUITE = artifact.currentFixtureSuite;

export type ConformancePin = {
	readonly packageVersion: string;
	readonly digest: string;
};

export const EXPECTED_PIN: ConformancePin = {
	packageVersion: CONTRACTS_PACKAGE_VERSION,
	digest: CONFORMANCE_DIGEST,
};

export function buildConformancePayload(): JsonValue {
	const payload = {
		packageVersion: CONTRACTS_PACKAGE_VERSION,
		artifactVersion: CONTRACTS_ARTIFACT_VERSION,
		failureCodes: [...commandFailureCodeSchema.options],
		normalizedFailures: NORMALIZED_FAILURE_CATALOG,
		commandTransitions: COMMAND_TRANSITIONS,
		workflowTransitions: WORKFLOW_TRANSITIONS,
		compatibilityMatrix: COMPATIBILITY_MATRIX,
		currentFixtureSuite: CURRENT_FIXTURE_SUITE,
		previousMinorFixtureSuite: PREVIOUS_MINOR_FIXTURE_SUITE,
	};
	return JSON.parse(JSON.stringify(payload)) as JsonValue;
}

export function computeConformanceDigest(
	payload: JsonValue = buildConformancePayload(),
): string {
	return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

/**
 * Fail closed when the consumer pin does not match this package's embedded digest.
 * Call at build and process startup before serving the Command surface.
 */
export function assertConformancePin(pin: ConformancePin): void {
	if (
		pin.packageVersion !== CONTRACTS_PACKAGE_VERSION ||
		pin.digest !== CONFORMANCE_DIGEST
	) {
		throw Object.assign(
			new Error("Pinned @86d-app/contracts version or digest does not match."),
			{
				failure: normalizedFailure("contract_version_mismatch"),
			},
		);
	}
	const live = computeConformanceDigest();
	if (live !== CONFORMANCE_DIGEST) {
		throw Object.assign(
			new Error("Embedded conformance digest does not match live artifact."),
			{
				failure: normalizedFailure("contract_version_mismatch"),
			},
		);
	}
}

export function isCompatiblePackagePair(
	consumerVersion: string,
	artifactVersion: string = CONTRACTS_ARTIFACT_VERSION,
): boolean {
	const listed = COMPATIBILITY_MATRIX.acceptedPairs.some(
		(pair) =>
			pair.consumer === consumerVersion && pair.artifact === artifactVersion,
	);
	return listed;
}

export { CURRENT_FIXTURE_SUITE as sharedCommandFixtures };
