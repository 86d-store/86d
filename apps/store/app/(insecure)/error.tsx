"use client";

import { useEffect } from "react";

export default function StorefrontError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[storefront error boundary]", error);
	}, [error]);

	return (
		<div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
			<p
				className="font-bold font-mono text-6xl text-muted-foreground"
				aria-hidden="true"
			>
				500
			</p>
			<h1 className="mt-4 font-semibold text-foreground text-xl tracking-tight">
				Something went wrong
			</h1>
			<p className="mt-2 text-muted-foreground text-sm">
				An unexpected error occurred while loading this page. Please try again.
			</p>
			<div className="mt-6 flex items-center gap-3">
				<button
					type="button"
					onClick={reset}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm transition-opacity hover:opacity-90"
				>
					Try again
				</button>
				<a
					href="/"
					className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
				>
					Go home
				</a>
			</div>
		</div>
	);
}
