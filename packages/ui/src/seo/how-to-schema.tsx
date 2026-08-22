import { serializeJsonLd } from "./serialize";

interface HowToStep {
	name: string;
	text: string;
	image?: string;
}

interface HowToSchemaProps {
	name: string;
	description: string;
	steps: HowToStep[];
	estimatedCost?: {
		currency: string;
		value: string;
	};
	supply?: string[];
	tool?: string[];
}

/**
 * Rendered as a plain `<script>` rather than `next/script`. In the App Router,
 * next/script returns null for an inline script on the default
 * `afterInteractive` strategy, so the JSON-LD never reaches the served HTML.
 */
export function HowToSchema({
	name,
	description,
	steps,
	estimatedCost,
	supply,
	tool,
}: HowToSchemaProps) {
	const howToSchema = {
		"@context": "https://schema.org",
		"@type": "HowTo",
		name,
		description,
		...(estimatedCost && { estimatedCost }),
		...(supply && { supply }),
		...(tool && { tool }),
		step: steps.map((step, index) => ({
			"@type": "HowToStep",
			position: index + 1,
			name: step.name,
			text: step.text,
			...(step.image && { image: step.image }),
		})),
	};

	return (
		<script type="application/ld+json">{serializeJsonLd(howToSchema)}</script>
	);
}
