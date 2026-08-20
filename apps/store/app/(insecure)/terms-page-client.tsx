"use client";

import TermsTemplate from "template/terms.mdx";

interface TermsPageClientProps {
	lastUpdated: string;
}

export default function TermsPageClient({ lastUpdated }: TermsPageClientProps) {
	return <TermsTemplate lastUpdated={lastUpdated} />;
}
