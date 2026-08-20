"use client";

import type { MDXComponents } from "mdx/types";
import { NewsletterForm } from "./newsletter-form";
import { NewsletterInline } from "./newsletter-inline";
import { NewsletterUnsubscribe } from "./newsletter-unsubscribe";

export default {
	NewsletterForm,
	NewsletterInline,
	NewsletterUnsubscribe,
} satisfies MDXComponents;
