"use client";

import { storeComponentLoaders } from "generated/store-loaders";
import { Suspense, useEffect, useState } from "react";
import { StorePageSkeleton } from "~/components/ui/page-skeleton";

interface StoreModuleRouteClientProps {
	moduleId: string;
	component: string;
	params: Record<string, string>;
}

export function StoreModuleRouteClient({
	moduleId,
	component,
	params,
}: StoreModuleRouteClientProps) {
	const [Component, setComponent] = useState<React.ComponentType<{
		slug?: string;
		params?: Record<string, string>;
	}> | null>(null);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		const loader = storeComponentLoaders[moduleId];
		if (!loader) {
			setError(new Error(`No store loader for module: ${moduleId}`));
			return;
		}
		loader()
			.then((components) => {
				// Loader returns unwrapped default (Record of components)
				const C = (components as Record<string, React.ComponentType<unknown>>)[
					component
				];
				if (!C) {
					setError(
						new Error(`Component ${component} not found in module ${moduleId}`),
					);
					return;
				}
				setComponent(() => C);
			})
			.catch(setError);
	}, [moduleId, component]);

	if (error) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive"
			>
				<p className="font-medium">Failed to load page</p>
				<p className="mt-1 text-sm">{error.message}</p>
			</div>
		);
	}

	if (!Component) {
		return <StorePageSkeleton />;
	}

	return (
		<Suspense fallback={<StorePageSkeleton />}>
			<Component {...(Object.keys(params).length > 0 ? { params } : {})} />
		</Suspense>
	);
}
