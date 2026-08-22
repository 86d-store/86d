import { serializeJsonLd } from "./serialize";

interface ArticleSchemaProps {
	headline: string;
	description: string;
	author: {
		name: string;
		url?: string;
	};
	datePublished: string;
	dateModified?: string;
	image?: string;
	url: string;
	publisher: {
		name: string;
		logo?: string;
	};
}

/**
 * Rendered as a plain `<script>` rather than `next/script`. In the App Router,
 * next/script returns null for an inline script on the default
 * `afterInteractive` strategy, so the JSON-LD never reaches the served HTML.
 */
export function ArticleSchema({
	headline,
	description,
	author,
	datePublished,
	dateModified,
	image,
	url,
	publisher,
}: ArticleSchemaProps) {
	const articleSchema = {
		"@context": "https://schema.org",
		"@type": "Article",
		headline,
		description,
		author: {
			"@type": "Person",
			name: author.name,
			...(author.url && { url: author.url }),
		},
		datePublished,
		...(dateModified && { dateModified }),
		...(image && { image }),
		url,
		publisher: {
			"@type": "Organization",
			name: publisher.name,
			...(publisher.logo && { logo: publisher.logo }),
		},
	};

	return (
		<script type="application/ld+json">{serializeJsonLd(articleSchema)}</script>
	);
}
