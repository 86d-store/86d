"use client";

import { useAnalytics } from "hooks/use-analytics";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * Fires a `pageView` analytics event on every client-side navigation.
 * Mount once at the layout level.
 */
function PageViewTrackerInner() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { track } = useAnalytics();
	const prevPath = useRef<string | null>(null);

	useEffect(() => {
		const url = searchParams.toString()
			? `${pathname}?${searchParams.toString()}`
			: pathname;

		// Avoid duplicate on first render re-fire
		if (prevPath.current === url) return;
		prevPath.current = url;

		track({
			type: "pageView",
			data: { path: pathname, url },
		});
	}, [pathname, searchParams, track]);

	return null;
}

/**
 * Suspense-wrapped page view tracker. Safe to mount in any layout —
 * `useSearchParams` requires a Suspense boundary.
 */
export function PageViewTracker() {
	return (
		<Suspense fallback={null}>
			<PageViewTrackerInner />
		</Suspense>
	);
}
