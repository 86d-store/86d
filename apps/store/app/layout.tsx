import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Inter, Zalando_Sans } from "next/font/google";
import { cookies, headers } from "next/headers";
import { ThemeProvider } from "next-themes";
import { Toaster } from "~/components/ui/sonner";
import "./globals.css";
import { GoogleTagManager } from "@next/third-parties/google";
import { StoreQueryProvider } from "components/providers";
import { ThemePreloadRelease } from "components/theme-preload-release";
import env from "env";
import { IBM_Plex_Mono, Merriweather } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { getBaseUrl } from "utils/url";
import { cn } from "~/lib/utils";
import { buildWebSiteJsonLd } from "../lib/seo";

export const metadata: Metadata = {
	metadataBase: new URL(getBaseUrl()),
	title: "86d — Dynamic Commerce Platform",
	description:
		"Sell now and sell out. Introducing the first dynamic commerce platform. Maintain your online presence with agentic assistance.",
	openGraph: {
		title: "86d — Dynamic Commerce Platform",
		description:
			"Sell now and sell out. Introducing the first dynamic commerce platform. Maintain your online presence with agentic assistance.",
		url: getBaseUrl(),
		siteName: "86d",
		images: "/opengraph-image",
	},
	alternates: {
		canonical: getBaseUrl(),
	},
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "white" },
		{ media: "(prefers-color-scheme: dark)", color: "black" },
	],
};

const display = Zalando_Sans({
	subsets: ["latin"],
	variable: "--font-display",
	weight: ["400", "700", "900"],
	style: ["normal", "italic"],
	adjustFontFallback: false,
});

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
	weight: ["400", "500", "700", "800", "900"],
});

const merriweather = Merriweather({
	subsets: ["latin"],
	variable: "--font-serif",
	weight: ["400", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
	weight: ["400", "600"],
});

/** Matches `globals.css` :root / .dark --background for first paint before Tailwind vars apply. */
const THEME_BG_LIGHT = "oklch(1 0 0)";
const THEME_BG_DARK = "oklch(0.145 0 0)";
const isVercelProduction =
	env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";

/**
 * Hint for critical CSS: which appearance to paint before client theme runs.
 * When cookie is `system`, prefer Client Hint over media queries when present.
 */
function themePreloadAttribute(
	initialTheme: "light" | "dark" | "system",
	secChPrefers: string | null,
): "dark" | "light" | "system" {
	if (initialTheme === "dark") return "dark";
	if (initialTheme === "light") return "light";
	if (secChPrefers === "dark" || secChPrefers === "light") {
		return secChPrefers;
	}
	return "system";
}

const themePreloadCriticalCss = `html[data-theme-preload=dark],html[data-theme-preload=dark] body{background-color:${THEME_BG_DARK}!important;color-scheme:dark}html[data-theme-preload=light],html[data-theme-preload=light] body{background-color:${THEME_BG_LIGHT}!important;color-scheme:light}html[data-theme-preload=system],html[data-theme-preload=system] body{background-color:${THEME_BG_LIGHT}!important;color-scheme:light}@media (prefers-color-scheme:dark){html[data-theme-preload=system],html[data-theme-preload=system] body{background-color:${THEME_BG_DARK}!important;color-scheme:dark}}`;

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const cookieStore = await cookies();
	const headerStore = await headers();
	const themeCookie = cookieStore.get("theme");
	const initialTheme =
		(themeCookie?.value as "light" | "dark" | "system" | undefined) || "system";
	const secChPrefers = headerStore.get("sec-ch-prefers-color-scheme");
	const themePreload = themePreloadAttribute(initialTheme, secChPrefers);

	const webSiteJsonLd = await buildWebSiteJsonLd();

	const themeScript = `(function(){try{var d=document.documentElement;var t=null;try{t=localStorage.getItem("theme");}catch(e){}if(t&&typeof t==="string"){t=t.replace(/^"|"$/g,"");}if(t!=="dark"&&t!=="light"&&t!=="system"){var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);if(m){try{t=decodeURIComponent(m[1]);}catch(e2){}}}if(t==="dark"){d.classList.add("dark");}else if(t==="light"){d.classList.remove("dark");}else{if(window.matchMedia("(prefers-color-scheme: dark)").matches)d.classList.add("dark");else d.classList.remove("dark");}}catch(e){}try{requestAnimationFrame(function(){requestAnimationFrame(function(){try{document.documentElement.removeAttribute("data-theme-preload");}catch(e3){}});});}catch(e4){}})();`;

	return (
		<html
			lang="en"
			suppressHydrationWarning
			data-theme-preload={themePreload}
			className={cn(
				merriweather.variable,
				ibmPlexMono.variable,
				display.variable,
				"font-sans",
				inter.variable,
			)}
		>
			<head>
				<meta httpEquiv="Accept-CH" content="Sec-CH-Prefers-Color-Scheme" />
				<style dangerouslySetInnerHTML={{ __html: themePreloadCriticalCss }} />
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify(webSiteJsonLd),
					}}
				/>
				{env.NODE_ENV === "development" && (
					<script
						crossOrigin="anonymous"
						src="//unpkg.com/react-scan/dist/auto.global.js"
					/>
				)}
			</head>
			{env.NODE_ENV === "production" &&
				env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID && (
					<GoogleTagManager gtmId={env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID} />
				)}
			<body
				className="min-h-screen bg-background text-foreground antialiased"
				suppressHydrationWarning
			>
				{isVercelProduction ? <Analytics /> : null}
				<NuqsAdapter>
					<StoreQueryProvider>
						<ThemeProvider
							attribute="class"
							defaultTheme={initialTheme}
							disableTransitionOnChange
							enableSystem
						>
							<ThemePreloadRelease />
							{children}
							<Toaster />
						</ThemeProvider>
					</StoreQueryProvider>
				</NuqsAdapter>
			</body>
		</html>
	);
}
