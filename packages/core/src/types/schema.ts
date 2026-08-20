import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Awaitable, LiteralString } from "./helper";

export type BaseModelNames = "user" | "account" | "session" | "verification";

export type ModelNames<T extends string = LiteralString> =
	| BaseModelNames
	| T
	| "rate-limit";

export type FieldType =
	| "string"
	| "number"
	| "boolean"
	| "date"
	| "json"
	| `${"string" | "number"}[]`
	| Array<LiteralString>;

export type Primitive =
	| string
	| number
	| boolean
	| Date
	| null
	| undefined
	| string[]
	| number[]
	| (Record<string, unknown> | unknown[]);

export type FieldAttributeConfig = {
	/**
	 * If the field should be required on a new record.
	 * @default true
	 */
	required?: boolean | undefined;
	/**
	 * If the value should be returned on a response body.
	 * @default true
	 */
	returned?: boolean | undefined;
	/**
	 * If a value should be provided when creating a new record.
	 * @default true
	 */
	input?: boolean | undefined;
	/**
	 * Default value for the field
	 *
	 * Note: This will not create a default value on the database level. It will only
	 * be used when creating a new record.
	 */
	defaultValue?: (Primitive | (() => Primitive)) | undefined;
	/**
	 * Update value for the field
	 *
	 * Note: This will create an onUpdate trigger on the database level for supported adapters.
	 * It will be called when updating a record.
	 */
	onUpdate?: (() => Primitive) | undefined;
	/**
	 * transform the value before storing it.
	 */
	transform?:
		| {
				input?: (value: Primitive) => Awaitable<Primitive>;
				output?: (value: Primitive) => Awaitable<Primitive>;
		  }
		| undefined;
	/**
	 * Reference to another model.
	 */
	references?:
		| {
				/**
				 * The model to reference.
				 */
				model: string;
				/**
				 * The field on the referenced model.
				 */
				field: string;
				/**
				 * The action to perform when the reference is deleted.
				 * @default "cascade"
				 */
				onDelete?:
					| "no action"
					| "restrict"
					| "cascade"
					| "set null"
					| "set default";
		  }
		| undefined;
	unique?: boolean | undefined;
	/**
	 * If the field should be a bigint on the database instead of integer.
	 */
	bigint?: boolean | undefined;
	/**
	 * A zod schema to validate the value.
	 */
	validator?:
		| {
				input?: StandardSchemaV1;
				output?: StandardSchemaV1;
		  }
		| undefined;
	/**
	 * The name of the field on the database.
	 */
	fieldName?: string | undefined;
	/**
	 * If the field should be sortable.
	 *
	 * applicable only for `text` type.
	 * It's useful to mark fields varchar instead of text.
	 */
	sortable?: boolean | undefined;
	/**
	 * If the field should be indexed.
	 * @default false
	 */
	index?: boolean | undefined;
};

export type FieldAttribute<T extends FieldType = FieldType> = {
	type: T;
} & FieldAttributeConfig;

export type ModuleSchema = {
	[table in string]: {
		fields: {
			[field: string]: FieldAttribute;
		};
		disableMigration?: boolean | undefined;
		modelName?: string | undefined;
	};
};
