"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemePreloadRelease() {
	const { resolvedTheme } = useTheme();
	useEffect(() => {
		if (!resolvedTheme) return;
		document.documentElement.removeAttribute("data-theme-preload");
	}, [resolvedTheme]);

	return null;
}
