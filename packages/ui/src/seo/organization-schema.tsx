import { serializeJsonLd } from "./serialize";

interface OrganizationSchemaProps {
	name: string;
	description: string;
	url: string;
	logo?: string;
	sameAs?: string[];
	email?: string;
	telephone?: string;
	contactPoint?: {
		contactType: string;
		email?: string;
		telephone?: string;
	};
	address?: {
		streetAddress: string;
		addressLocality: string;
		addressRegion: string;
		postalCode: string;
		addressCountry: string;
	};
}

/**
 * Rendered as a plain `<script>` rather than `next/script`. In the App Router,
 * next/script returns null for an inline script on the default
 * `afterInteractive` strategy, so the JSON-LD never reaches the served HTML.
 */
export function OrganizationSchema({
	name,
	description,
	url,
	logo,
	sameAs,
	email,
	telephone,
	contactPoint,
	address,
}: OrganizationSchemaProps) {
	const organizationSchema = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name,
		description,
		url,
		...(logo && { logo }),
		...(sameAs && { sameAs }),
		...(email && { email }),
		...(telephone && { telephone }),
		...(contactPoint && {
			contactPoint: {
				"@type": "ContactPoint",
				contactType: contactPoint.contactType,
				...(contactPoint.email && { email: contactPoint.email }),
				...(contactPoint.telephone && { telephone: contactPoint.telephone }),
			},
		}),
		...(address && {
			address: {
				"@type": "PostalAddress",
				streetAddress: address.streetAddress,
				addressLocality: address.addressLocality,
				addressRegion: address.addressRegion,
				postalCode: address.postalCode,
				addressCountry: address.addressCountry,
			},
		}),
	};

	return (
		<script type="application/ld+json">
			{serializeJsonLd(organizationSchema)}
		</script>
	);
}
