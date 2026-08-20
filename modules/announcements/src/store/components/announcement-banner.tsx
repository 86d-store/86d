"use client";

import { useEffect, useRef } from "react";
import { useAnnouncementsApi } from "./_hooks";

interface AnnouncementData {
	id: string;
	title: string;
	content: string;
	type: string;
	linkUrl?: string;
	linkText?: string;
	backgroundColor?: string;
	textColor?: string;
}

export function AnnouncementBanner({
	audience,
}: {
	audience?: "all" | "authenticated" | "guest";
}) {
	const api = useAnnouncementsApi();
	const recordedRef = useRef<Set<string>>(new Set());

	const { data, isLoading } = api.getActive.useQuery({
		query: { audience },
	}) as {
		data: { announcements: AnnouncementData[] } | undefined;
		isLoading: boolean;
	};

	const clickMutation = api.recordClick.useMutation();
	const impressionMutation = api.recordImpression.useMutation();

	const banners = (data?.announcements ?? []).filter(
		(a) => a.type === "banner",
	);

	const banner = banners[0] ?? null;

	useEffect(() => {
		if (!banner || recordedRef.current.has(banner.id)) return;
		recordedRef.current.add(banner.id);
		impressionMutation.mutate({ params: { id: banner.id } });
	}, [banner, impressionMutation]);

	if (isLoading) {
		return (
			<div className="w-full animate-pulse rounded-xl bg-muted px-6 py-8">
				<div className="mx-auto h-7 w-2/3 rounded-lg bg-muted-foreground/20" />
				<div className="mx-auto mt-3 h-5 w-1/2 rounded bg-muted-foreground/20" />
			</div>
		);
	}

	if (!banner) return null;

	const hasCustomBg = Boolean(banner.backgroundColor);
	const wrapperStyle = hasCustomBg
		? {
				backgroundColor: banner.backgroundColor,
				color: banner.textColor ?? "#ffffff",
			}
		: undefined;

	const handleClick = () => {
		clickMutation.mutate({ params: { id: banner.id } });
	};

	return (
		<div
			className={`w-full rounded-xl px-6 py-8 text-center ${
				hasCustomBg ? "" : "bg-foreground text-background"
			}`}
			style={wrapperStyle}
		>
			<h2 className="text-balance font-bold text-2xl">{banner.title}</h2>
			<p className="mt-3 text-pretty opacity-80">{banner.content}</p>
			{banner.linkUrl && (
				<a
					href={banner.linkUrl}
					onClick={handleClick}
					className={`mt-5 inline-block rounded-full px-6 py-2.5 font-medium text-sm transition-opacity hover:opacity-90 ${
						hasCustomBg
							? "bg-white/20 text-inherit"
							: "bg-background text-foreground"
					}`}
				>
					{banner.linkText ?? "Learn more"}
				</a>
			)}
		</div>
	);
}
