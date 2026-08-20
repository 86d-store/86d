"use client";

import { useState } from "react";
import { useSocialSharingApi } from "./_hooks";

const NETWORKS = [
	{
		id: "twitter",
		label: "X",
		title: "Share on X",
		buildUrl: (url: string, message: string) =>
			`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
	},
	{
		id: "facebook",
		label: "f",
		title: "Share on Facebook",
		buildUrl: (url: string) =>
			`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
	},
	{
		id: "pinterest",
		label: "Pin",
		title: "Pin on Pinterest",
		buildUrl: (url: string, message: string) =>
			`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(message)}`,
	},
] as const;

export interface SocialSharingSectionProps {
	productId: string;
	productName: string;
	productUrl: string;
}

/**
 * Social sharing buttons for the product detail page.
 * Records shares via the social-sharing module when available.
 * Returns null when the module is not installed (API call fails).
 */
export function SocialSharingSection({
	productId,
	productName,
	productUrl,
}: SocialSharingSectionProps) {
	const api = useSocialSharingApi();
	const [copied, setCopied] = useState(false);

	const shareMutation = api.share.useMutation({
		onError: () => {},
	});

	const handleShare = (networkId: string, shareUrl: string) => {
		window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=450");
		shareMutation.mutate({
			targetType: "product",
			targetId: productId,
			network: networkId,
			url: productUrl,
		});
	};

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(productUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			shareMutation.mutate({
				targetType: "product",
				targetId: productId,
				network: "link",
				url: productUrl,
			});
		} catch {
			// Clipboard not available
		}
	};

	return (
		<div className="flex items-center gap-2">
			<span className="text-muted-foreground text-xs">Share:</span>
			<div className="flex items-center gap-1.5">
				{NETWORKS.map((network) => (
					<button
						key={network.id}
						type="button"
						title={network.title}
						onClick={() =>
							handleShare(network.id, network.buildUrl(productUrl, productName))
						}
						className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
						aria-label={network.title}
					>
						{network.label}
					</button>
				))}
				<button
					type="button"
					title="Copy link"
					onClick={handleCopyLink}
					className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
					aria-label="Copy link to product"
				>
					{copied ? (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M20 6 9 17l-5-5" />
						</svg>
					) : (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
							<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
						</svg>
					)}
				</button>
			</div>
		</div>
	);
}
