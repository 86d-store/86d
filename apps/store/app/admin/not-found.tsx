import { SearchXIcon } from "lucide-react";
import { PageState } from "~/components/page-state";

export default function NotFound() {
	return (
		<PageState
			title="Page not found"
			description="This store admin page doesn’t exist or has been removed. Return to your dashboard to continue."
			icon={<SearchXIcon aria-hidden="true" />}
			actionHref="/admin"
			actionLabel="Back to dashboard"
		/>
	);
}
