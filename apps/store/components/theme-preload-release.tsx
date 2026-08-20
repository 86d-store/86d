"use client";

import { useEffect } from "react";

/**
 * Drops `data-theme-preload` once after mount so first-paint critical CSS (!important)
 * does not override Tailwind — without re-running on every `resolvedTheme` change (which
 * caused visible flicker).
 */
export function ThemePreloadRelease() {
	useEffect(() => {
		document.documentElement.removeAttribute("data-theme-preload");
	}, []);

	return null;
}
