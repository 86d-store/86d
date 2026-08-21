import { z } from "zod";

export type JsonValue =
	| boolean
	| null
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number().finite(),
		z.boolean(),
		z.null(),
		z.array(jsonValueSchema),
		z.record(z.string(), jsonValueSchema),
	]),
);

export const identifierSchema = z.string().min(1).max(255);
export const versionSchema = z.number().int().positive();
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const dateTimeSchema = z.string().datetime();
export const permissionSchema = z.string().min(1).max(200);
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const minorAmountSchema = z.string().regex(/^(?:0|[1-9]\d*)$/);
