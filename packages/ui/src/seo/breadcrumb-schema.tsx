import { serializeJsonLd } from "./serialize";

interface BreadcrumbItem {
	name: string;
	item: string;
}

interface BreadcrumbSchemaProps {
	items: BreadcrumbItem[];
}

/**
 * Rendered as a plain `<script>` rather than `next/script`. In the App Router,
 * next/script returns null for an inline script on the default
 * `afterInteractive` strategy, so the JSON-LD never reaches the served HTML.
 */
export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
	const breadcrumbSchema = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: item.item,
		})),
	};

	return (
		<script type="application/ld+json">
			{serializeJsonLd(breadcrumbSchema)}
		</script>
	);
}
