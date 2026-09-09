import { SearchXIcon } from "lucide-react";
import { PageState } from "~/components/page-state";

export default function NotFound() {
	return (
		<PageState
			title="Page not found"
			description="This page may have moved. Explore the store or return to the home page."
			icon={<SearchXIcon aria-hidden="true" />}
			actionHref="/products"
			actionLabel="Browse products"
			secondaryHref="/"
			secondaryLabel="Go home"
		/>
	);
}
