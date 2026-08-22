import { serializeJsonLd } from "./serialize";

interface FAQ {
	question: string;
	/**
	 * Plain text. JSON-LD carries no markup, and a ReactNode here would
	 * serialize to a React element object instead of an answer.
	 */
	answer: string;
	id: string;
}

interface FAQSchemaProps {
	faqs: FAQ[];
}

/**
 * Rendered as a plain `<script>` rather than `next/script`. In the App Router,
 * next/script returns null for an inline script on the default
 * `afterInteractive` strategy, so the JSON-LD never reaches the served HTML.
 */
export function FAQSchema({ faqs }: FAQSchemaProps) {
	const faqSchema = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((faq) => ({
			"@type": "Question",
			name: faq.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: faq.answer,
			},
		})),
	};

	return (
		<script type="application/ld+json">{serializeJsonLd(faqSchema)}</script>
	);
}
