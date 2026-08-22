import { serializeJsonLd } from "./serialize";

interface SoftwareApplicationSchemaProps {
	name: string;
	description: string;
	url: string;
	applicationCategory: string;
	operatingSystem?: string[];
	offers?:
		| {
				price: string;
				currency: string;
				availability: string;
				name?: string;
				description?: string;
		  }
		| {
				price: string;
				currency: string;
				availability: string;
				name?: string;
				description?: string;
		  }[];
	aggregateRating?: {
		ratingValue: string;
		reviewCount: string;
	};
	screenshot?: string[];
}

/**
 * Rendered as a plain `<script>` rather than `next/script`. In the App Router,
 * next/script returns null for an inline script on the default
 * `afterInteractive` strategy, so the JSON-LD never reaches the served HTML.
 */
export function SoftwareApplicationSchema({
	name,
	description,
	url,
	applicationCategory,
	operatingSystem,
	offers,
	aggregateRating,
	screenshot,
}: SoftwareApplicationSchemaProps) {
	const softwareSchema = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name,
		description,
		url,
		applicationCategory,
		...(operatingSystem && { operatingSystem }),
		...(offers && {
			offers: Array.isArray(offers)
				? offers.map((offer) => ({
						"@type": "Offer",
						...(offer.name && { name: offer.name }),
						...(offer.description && { description: offer.description }),
						price: offer.price,
						priceCurrency: offer.currency,
						availability: `https://schema.org/${offer.availability}`,
					}))
				: {
						"@type": "Offer",
						...(offers.name && { name: offers.name }),
						...(offers.description && { description: offers.description }),
						price: offers.price,
						priceCurrency: offers.currency,
						availability: `https://schema.org/${offers.availability}`,
					},
		}),
		...(aggregateRating && {
			aggregateRating: {
				"@type": "AggregateRating",
				ratingValue: aggregateRating.ratingValue,
				reviewCount: aggregateRating.reviewCount,
			},
		}),
		...(screenshot && { screenshot }),
	};

	return (
		<script type="application/ld+json">
			{serializeJsonLd(softwareSchema)}
		</script>
	);
}
