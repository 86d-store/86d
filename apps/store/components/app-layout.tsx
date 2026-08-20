"use client";

import type { Config } from "@86d-app/sdk/types";
import { PageViewTracker } from "components/analytics-tracker";
import { AppStateProvider } from "hooks/use-app";
import Layout from "template/layout.mdx";
import { useMDXComponents } from "~/mdx-components";

export function AppLayout({
	children,
	config,
}: {
	children: React.ReactNode;
	config: Config;
}) {
	const components = useMDXComponents();
	return (
		<AppStateProvider config={config}>
			<Layout config={config} components={components}>
				<PageViewTracker />
				{children}
			</Layout>
		</AppStateProvider>
	);
}
