"use client";

import type { NewsletterFormProps } from "./newsletter-form";
import { NewsletterForm } from "./newsletter-form";

/** NewsletterInline is an alias for compact NewsletterForm */
export function NewsletterInline(
	props: Omit<NewsletterFormProps, "compact"> & { compact?: boolean },
) {
	return <NewsletterForm {...props} compact={true} />;
}
