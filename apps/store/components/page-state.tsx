import type { ReactNode } from "react";
import PageStateTemplate from "./page-state.mdx";

export interface PageStateProps {
	title: string;
	description: string;
	icon: ReactNode;
	actionHref: string;
	actionLabel: string;
	secondaryHref?: string;
	secondaryLabel?: string;
	onRetry?: () => void;
}

export function PageState(props: PageStateProps) {
	return <PageStateTemplate {...props} />;
}
