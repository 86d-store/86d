"use client";

import { adminComponentLoaders } from "generated/admin-loaders";
import {
	Component as ReactComponent,
	Suspense,
	useEffect,
	useState,
} from "react";
import { AdminPageSkeleton } from "~/components/admin/page-skeleton";
import { resolveAdminRouteComponent } from "./admin-component-loader";

interface AdminModuleRouteClientProps {
	moduleId: string;
	component: string;
	params: Record<string, string>;
}

interface ErrorBoundaryProps {
	moduleId: string;
	children: React.ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

class AdminModuleErrorBoundary extends ReactComponent<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	override render() {
		if (this.state.error) {
			return (
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive"
				>
					<p className="font-medium">
						Module "{this.props.moduleId}" encountered an error
					</p>
					<p className="mt-1 text-sm">{this.state.error.message}</p>
					<button
						type="button"
						onClick={() => this.setState({ error: null })}
						className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
					>
						Try again
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}

export function AdminModuleRouteClient({
	moduleId,
	component,
	params,
}: AdminModuleRouteClientProps) {
	const [Component, setComponent] = useState<React.ComponentType<{
		params?: Record<string, string>;
	}> | null>(null);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setComponent(null);
		setError(null);

		const loader = adminComponentLoaders[`${moduleId}:${component}`];
		if (!loader) {
			setError(new Error(`No admin loader for ${moduleId}:${component}`));
			return;
		}
		loader()
			.then((mod) => {
				const resolved = resolveAdminRouteComponent(
					mod as Record<string, unknown>,
					moduleId,
					component,
				);
				setComponent(() => resolved);
			})
			.catch(setError);
	}, [moduleId, component]);

	if (error) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive"
			>
				<p className="font-medium">Failed to load admin page</p>
				<p className="mt-1 text-sm">{error.message}</p>
			</div>
		);
	}

	if (!Component) {
		return <AdminPageSkeleton />;
	}

	return (
		<AdminModuleErrorBoundary moduleId={moduleId}>
			<Suspense fallback={<AdminPageSkeleton />}>
				<Component {...(Object.keys(params).length > 0 ? { params } : {})} />
			</Suspense>
		</AdminModuleErrorBoundary>
	);
}
