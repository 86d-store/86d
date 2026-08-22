import { serializeJsonLd } from "./serialize";

interface WebsiteSchemaProps {
	name: string;
	description: string;
	url: string;
	sameAs?: string[];
}

/**
 * Rendered as a plain `<script>` rather than `next/script`. In the App Router,
 * next/script returns null for an inline script on the default
 * `afterInteractive` strategy, so the JSON-LD never reaches the served HTML.
 */
export function WebsiteSchema({
	name,
	description,
	url,
	sameAs,
}: WebsiteSchemaProps) {
	const websiteSchema = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name,
		description,
		url,
		...(sameAs && { sameAs }),
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${url}/search?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};

	return (
		<script type="application/ld+json">{serializeJsonLd(websiteSchema)}</script>
	);
}
