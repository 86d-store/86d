export type GraphDiagnosticCode =
	| "INVALID_RANGE_GRAMMAR"
	| "DUPLICATE_IDENTITY"
	| "REQUIRED_OWNER_ABSENT"
	| "OPTIONAL_OWNER_ABSENT"
	| "INSTALLED_OWNER_MISSING_CONTRACT"
	| "INCOMPATIBLE_VERSION"
	| "MISSING_READER"
	| "MISSING_TEMPLATE_DATA"
	| "HOOK_CYCLE"
	| "HOOK_ORDER_REFERENCE_ABSENT"
	| "INVALID_EVENT_VERSION"
	| "DUPLICATE_MODULE_ID"
	| "INVALID_HOOK_PRIORITY"
	| "INVALID_HOOK_IDENTITY"
	| "EVENT_CONSUMER_GAP"
	| "MINIMUM_IMPLEMENTERS";

export type GraphDiagnostic = Readonly<{
	code: GraphDiagnosticCode;
	message: string;
	moduleId?: string | undefined;
	edge?: string | undefined;
}>;

export class GraphCompileError extends Error {
	readonly diagnostics: readonly GraphDiagnostic[];

	constructor(diagnostics: readonly GraphDiagnostic[]) {
		super(formatGraphDiagnostics(diagnostics));
		this.name = "GraphCompileError";
		this.diagnostics = diagnostics;
	}
}

export function formatGraphDiagnostics(
	diagnostics: readonly GraphDiagnostic[],
): string {
	const lines = diagnostics.map((diagnostic) => {
		const parts = [`[${diagnostic.code}] ${diagnostic.message}`];
		if (diagnostic.moduleId) parts.push(`module=${diagnostic.moduleId}`);
		if (diagnostic.edge) parts.push(`edge=${diagnostic.edge}`);
		return `  - ${parts.join(" ")}`;
	});
	return `Execution graph compile failed:\n${lines.join("\n")}`;
}

/** Stable diagnostic fingerprint for golden fixtures. */
export function diagnosticFingerprint(
	diagnostics: readonly GraphDiagnostic[],
): string {
	return diagnostics
		.map((diagnostic) =>
			[
				diagnostic.code,
				diagnostic.moduleId ?? "",
				diagnostic.edge ?? "",
				diagnostic.message,
			].join("|"),
		)
		.join("\n");
}
