"use client";

import PrivacyTemplate from "template/privacy.mdx";

interface PrivacyPageClientProps {
	lastUpdated: string;
}

export default function PrivacyPageClient({
	lastUpdated,
}: PrivacyPageClientProps) {
	return <PrivacyTemplate lastUpdated={lastUpdated} />;
}
