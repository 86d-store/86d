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
			description="Try loading the page again, or return to your dashboard to continue managing your store."
			icon={<CircleAlertIcon aria-hidden="true" />}
			onRetry={reset}
			actionHref="/admin"
			actionLabel="Back to dashboard"
		/>
	);
}
