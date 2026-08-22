import type { z } from "zod";

export function createZodFormAdapter<TSchema extends z.ZodType>(
	schema: TSchema,
) {
	return {
		schema,
		parse(input: unknown): z.infer<TSchema> {
			return schema.parse(input);
		},
		safeParse(input: unknown) {
			return schema.safeParse(input);
		},
		defaultValues(values: z.input<TSchema>): z.input<TSchema> {
			return values;
		},
		roundTrip(values: unknown): z.infer<TSchema> {
			return schema.parse(values);
		},
	};
}
