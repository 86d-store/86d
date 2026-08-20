"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[store error boundary]", error);
	}, [error]);

	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
			<p className="font-bold font-mono text-7xl text-muted-foreground">500</p>
			<h1 className="mt-4 font-semibold text-foreground text-xl tracking-tight">
				Something went wrong
			</h1>
			<p className="mt-2 max-w-md text-muted-foreground text-sm">
				An unexpected error occurred. Please try again or return to the
				homepage.
			</p>
			<div className="mt-6 flex items-center gap-3">
				<button
					type="button"
					onClick={reset}
					className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm transition-colors hover:bg-foreground/90"
				>
					Try again
				</button>
				<a
					href="/"
					className="rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
				>
					Go home
				</a>
			</div>
		</div>
	);
}
