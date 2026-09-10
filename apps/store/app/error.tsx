"use client";

import { CircleAlertIcon } from "lucide-react";
import { PageState } from "~/components/page-state";

export default function ErrorBoundary({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<PageState
			title="We couldn’t load this page"
			description="Try loading the page again. You can also return to the home page."
			icon={<CircleAlertIcon aria-hidden="true" />}
			onRetry={reset}
			actionHref="/"
			actionLabel="Go home"
		/>
	);
}
