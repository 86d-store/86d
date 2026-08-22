/**
 * Serializes a JSON-LD object for embedding in a `<script>` tag.
 *
 * `JSON.stringify` does not escape `<`, so a string value containing
 * `</script>` would close the tag early and turn the rest of the payload into
 * markup. Escaping the character to its unicode form keeps the JSON valid and
 * the tag intact.
 */
export function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}
