export function stripTags(input: string): string {
	return input
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]*>/g, "");
}

export function normalizeWhitespace(input: string): string {
	return input.replace(/\s+/g, " ").trim();
}

export function sanitizeText(input: string): string {
	return normalizeWhitespace(stripTags(input));
}
