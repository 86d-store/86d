import type { ZodType } from "zod";

export type ZodDef = {
	type?: string;
	typeName?: string;
	innerType?: unknown;
	coerce?: unknown;
	checks?: readonly { kind?: string; value?: unknown }[];
	entries?: Record<string, string>;
	defaultValue?: unknown;
	element?: unknown;
	keyType?: unknown;
	valueType?: unknown;
};

export type FieldWrappers = Readonly<{
	optional: boolean;
	nullable: boolean;
	hasDefault: boolean;
	defaultValue: unknown;
	inner: ZodType;
}>;

/** Read Zod 4 def from a schema instance. */
export function getZodDef(schema: unknown): ZodDef | undefined {
	const withZod = schema as { _zod?: { def?: ZodDef }; def?: ZodDef };
	return withZod._zod?.def ?? withZod.def;
}

/** Classify the base Zod construct after wrappers are removed. */
export function classifyZodBase(schema: ZodType): string {
	const withFormat = schema as { isInt?: boolean; format?: string };
	const def = getZodDef(schema);
	const typeName = def?.type ?? def?.typeName;

	if (withFormat.format === "uuid" || typeName === "uuid") {
		return "uuid";
	}
	if (withFormat.isInt || withFormat.format === "safeint") {
		return "int";
	}
	if (typeName === "date" && def?.coerce) {
		return "date.coerce";
	}
	if (typeof typeName === "string" && typeName.length > 0) {
		return typeName;
	}
	return "unknown";
}

/** Unwrap optional / nullable / default wrappers; preserve each independently. */
export function unwrapFieldWrappers(schema: ZodType): FieldWrappers {
	let current: ZodType = schema;
	let optional = false;
	let nullable = false;
	let hasDefault = false;
	let defaultValue: unknown;

	for (;;) {
		const def = getZodDef(current);
		const typeName = def?.type ?? def?.typeName;
		if (typeName === "optional") {
			optional = true;
			const inner = def?.innerType;
			if (!inner || typeof inner !== "object") {
				break;
			}
			current = inner as ZodType;
			continue;
		}
		if (typeName === "nullable") {
			nullable = true;
			const inner = def?.innerType;
			if (!inner || typeof inner !== "object") {
				break;
			}
			current = inner as ZodType;
			continue;
		}
		if (typeName === "default") {
			hasDefault = true;
			optional = true;
			const raw = def?.defaultValue;
			defaultValue = typeof raw === "function" ? (raw as () => unknown)() : raw;
			const inner = def?.innerType;
			if (!inner || typeof inner !== "object") {
				break;
			}
			current = inner as ZodType;
			continue;
		}
		break;
	}

	return { optional, nullable, hasDefault, defaultValue, inner: current };
}

export function finiteBound(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	return undefined;
}

function isImplicitNumericBound(value: number): boolean {
	return (
		!Number.isFinite(value) ||
		value === Number.MIN_SAFE_INTEGER ||
		value === Number.MAX_SAFE_INTEGER
	);
}

function checkKind(check: {
	kind?: string;
	_zod?: { def?: { check?: string; value?: unknown } };
}): string | undefined {
	return check._zod?.def?.check ?? check.kind;
}

function checkValue(check: {
	value?: unknown;
	_zod?: {
		def?: {
			value?: unknown;
			minimum?: unknown;
			maximum?: unknown;
		};
	};
}): unknown {
	const def = check._zod?.def;
	return def?.value ?? def?.minimum ?? def?.maximum ?? check.value;
}

/** Collect finite min/max and length checks from a base Zod schema. */
export function readFiniteChecks(schema: ZodType): {
	minValue?: number;
	maxValue?: number;
	minLength?: number;
	maxLength?: number;
} {
	const withBounds = schema as {
		minValue?: number;
		maxValue?: number;
		minLength?: number | null;
		maxLength?: number | null;
	};

	const result: {
		minValue?: number;
		maxValue?: number;
		minLength?: number;
		maxLength?: number;
	} = {};

	const minValue = finiteBound(withBounds.minValue);
	const maxValue = finiteBound(withBounds.maxValue);
	if (minValue !== undefined && !isImplicitNumericBound(minValue)) {
		result.minValue = minValue;
	}
	if (maxValue !== undefined && !isImplicitNumericBound(maxValue)) {
		result.maxValue = maxValue;
	}
	if (
		typeof withBounds.minLength === "number" &&
		Number.isFinite(withBounds.minLength)
	) {
		result.minLength = withBounds.minLength;
	}
	if (
		typeof withBounds.maxLength === "number" &&
		Number.isFinite(withBounds.maxLength)
	) {
		result.maxLength = withBounds.maxLength;
	}

	const def = getZodDef(schema);
	for (const check of def?.checks ?? []) {
		const kind = checkKind(check as never);
		const value = checkValue(check as never);
		if (
			(kind === "min" || kind === "greater_than") &&
			typeof value === "number"
		) {
			const bound = finiteBound(value);
			if (bound !== undefined && !isImplicitNumericBound(bound)) {
				result.minValue = bound;
			}
		}
		if ((kind === "max" || kind === "less_than") && typeof value === "number") {
			const bound = finiteBound(value);
			if (bound !== undefined && !isImplicitNumericBound(bound)) {
				result.maxValue = bound;
			}
		}
		if (
			(kind === "min_length" || kind === "min_length_check") &&
			typeof value === "number"
		) {
			result.minLength = value;
		}
		if (
			(kind === "max_length" || kind === "max_length_check") &&
			typeof value === "number"
		) {
			result.maxLength = value;
		}
	}

	return result;
}

export function readEnumValues(schema: ZodType): readonly string[] | undefined {
	const def = getZodDef(schema);
	if ((def?.type ?? def?.typeName) !== "enum" || !def?.entries) {
		return undefined;
	}
	return Object.keys(def.entries);
}
