import type { z } from "zod";
import type { StableSemVer } from "../schema/declaration";
import type { ContractRange } from "./contract-range";

/** Versioned template data projection declared by a Module. */
export type TemplateDataProjection<
	Name extends string = string,
	Version extends string = string,
	Shape extends z.ZodType = z.ZodType,
> = Readonly<{
	name: Name;
	version: Version;
	shape: Shape;
	resolve: (ctx: unknown) => Promise<z.infer<Shape>> | z.infer<Shape>;
}>;

export type AnyTemplateDataProjection = TemplateDataProjection<
	string,
	string,
	z.ZodType
>;

export function projection<
	const Name extends string,
	const Version extends string,
	Shape extends z.ZodType,
>(definition: {
	name: Name;
	version: Version;
	shape: Shape;
	resolve: (ctx: unknown) => Promise<z.infer<Shape>> | z.infer<Shape>;
}): TemplateDataProjection<Name, Version, Shape> {
	return Object.freeze({ ...definition });
}

/** Consumer edge for a published storage view (reader). */
export type ReaderAcceptance = Readonly<{
	owner: string;
	name: string;
	versions: readonly ContractRange[];
	optional?: true | undefined;
}>;

/** Template frontmatter data requirement. */
export type TemplateDataRequirement = Readonly<{
	/** `owner.name` projection identity. */
	projection: string;
	versions: readonly ContractRange[];
	optional?: true | undefined;
}>;

export type CompiledReaderBinding =
	| Readonly<{
			available: true;
			owner: string;
			name: string;
			version: StableSemVer;
			table: string;
			columns: readonly string[];
	  }>
	| Readonly<{
			available: false;
			reason: "OWNER_NOT_INSTALLED";
			owner: string;
			name: string;
	  }>;

export type CompiledTemplateProjectionBinding =
	| Readonly<{
			available: true;
			owner: string;
			name: string;
			version: StableSemVer;
	  }>
	| Readonly<{
			available: false;
			reason: "OWNER_NOT_INSTALLED";
			owner: string;
			name: string;
	  }>
	| Readonly<{
			available: false;
			reason: "OPTIONAL_UNDEFINED";
			owner: string;
			name: string;
	  }>;
