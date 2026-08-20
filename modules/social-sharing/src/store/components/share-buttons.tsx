"use client";

import { useState } from "react";
import { useShareApi } from "./_hooks";
import ShareButtonsTemplate from "./share-buttons.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface ShareButtonsProps {
	targetType: string;
	targetId: string;
	url: string;
	message?: string;
}

// ── Network Config ───────────────────────────────────────────────────────────

const SHARE_NETWORKS = [
	{
		id: "twitter",
		label: "\ud835\udd4f",
		title: "Share on X",
		color:
			"bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60",
	},
	{
		id: "facebook",
		label: "f",
		title: "Share on Facebook",
		color:
			"bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60",
	},
	{
		id: "pinterest",
		label: "\ud83d\udccc",
		title: "Pin on Pinterest",
		color:
			"bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60",
	},
	{
		id: "linkedin",
		label: "in",
		title: "Share on LinkedIn",
		color:
			"bg-blue-200 text-blue-800 hover:bg-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900/70",
	},
	{
		id: "whatsapp",
		label: "\ud83d\udcac",
		title: "Share on WhatsApp",
		color:
			"bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60",
	},
	{
		id: "email",
		label: "\u2709",
		title: "Share via Email",
		color:
			"bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60",
	},
	{
		id: "copy-link",
		label: "\ud83d\udd17",
		title: "Copy link",
		color:
			"bg-muted text-muted-foreground hover:bg-muted/60 dark:hover:bg-muted/80",
	},
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function ShareButtons({
	targetType,
	targetId,
	url,
	message,
}: ShareButtonsProps) {
	const api = useShareApi();
	const [copied, setCopied] = useState(false);

	const { data: countData } = api.getCount.useQuery({
		targetType,
		targetId,
	}) as {
		data: { count: number } | undefined;
		isLoading: boolean;
	};

	const shareMutation = api.share.useMutation({
		onSuccess: () => {
			void api.getCount.invalidate();
		},
	});

	const shareCount = countData?.count ?? 0;

	const handleShare = (network: string) => {
		// Record the share event
		shareMutation.mutate({
			targetType,
			targetId,
			network,
			url,
		});

		if (network === "copy-link") {
			void navigator.clipboard.writeText(url).then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			});
			return;
		}

		// Build the share URL and open in new window
		const shareUrl = buildFallbackShareUrl(network, url, message);
		if (shareUrl) {
			window.open(shareUrl, "_blank", "noopener,noreferrer");
		}
	};

	const buttons = SHARE_NETWORKS.map((net) => (
		<button
			key={net.id}
			type="button"
			onClick={() => handleShare(net.id)}
			title={net.id === "copy-link" && copied ? "Copied!" : net.title}
			className={`inline-flex h-9 w-9 items-center justify-center rounded-full font-medium text-sm transition-colors ${net.color}`}
		>
			{net.id === "copy-link" && copied ? "\u2713" : net.label}
		</button>
	));

	return <ShareButtonsTemplate shareCount={shareCount} buttons={buttons} />;
}

// ── Fallback URL Builder ─────────────────────────────────────────────────────

function buildFallbackShareUrl(
	network: string,
	targetUrl: string,
	message?: string,
): string {
	const encoded = encodeURIComponent(targetUrl);
	const text = encodeURIComponent(message ?? "");

	switch (network) {
		case "twitter":
			return `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`;
		case "facebook":
			return `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
		case "pinterest":
			return `https://pinterest.com/pin/create/button/?url=${encoded}&description=${text}`;
		case "linkedin":
			return `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`;
		case "whatsapp":
			return `https://wa.me/?text=${text}%20${encoded}`;
		case "email":
			return `mailto:?subject=${text}&body=${encoded}`;
		default:
			return "";
	}
}
