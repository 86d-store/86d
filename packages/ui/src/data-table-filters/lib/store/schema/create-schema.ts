import { getSchemaDefaults } from "~/data-table-filters/lib/store/schema/serialization";
import type {
	Schema,
	SchemaDefinition,
} from "~/data-table-filters/lib/store/schema/types";

/**
 * Create a schema from field definitions.
 */
export function createSchema<T extends SchemaDefinition>(
	definition: T,
): Schema<T> {
	const defaults = getSchemaDefaults(definition);

	return {
		definition,
		defaults,
		_type: defaults,
	};
}
