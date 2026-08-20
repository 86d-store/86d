"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAnnouncementsApi } from "./_hooks";

interface AnnouncementData {
	id: string;
	title: string;
	content: string;
	type: string;
	position: string;
	linkUrl?: string;
	linkText?: string;
	backgroundColor?: string;
	textColor?: string;
	isDismissible: boolean;
}

function useDismissed() {
	const key = "86d:dismissed-announcements";
	const getDismissed = (): Set<string> => {
		try {
			const raw = localStorage.getItem(key);
			return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
		} catch {
			return new Set();
		}
	};
	const addDismissed = (id: string) => {
		try {
			const set = getDismissed();
			set.add(id);
			localStorage.setItem(key, JSON.stringify([...set]));
		} catch {
			// ignore
		}
	};
	return { getDismissed, addDismissed };
}

function AnnouncementBarItem({
	announcement,
	onDismiss,
	onLinkClick,
}: {
	announcement: AnnouncementData;
	onDismiss: (id: string) => void;
	onLinkClick: (id: string) => void;
}) {
	const hasCustomBg = Boolean(announcement.backgroundColor);

	const wrapperStyle = hasCustomBg
		? {
				backgroundColor: announcement.backgroundColor,
				color: announcement.textColor ?? "#ffffff",
			}
		: undefined;

	const linkStyle =
		announcement.textColor && hasCustomBg
			? { color: announcement.textColor }
			: undefined;

	return (
		<div
			className={`relative flex min-h-9 items-center justify-center gap-3 px-10 py-2 text-center text-sm ${
				hasCustomBg
					? ""
					: "bg-foreground text-background dark:bg-background dark:text-foreground"
			}`}
			style={wrapperStyle}
		>
			<span className="text-pretty">{announcement.content}</span>
			{announcement.linkUrl && (
				<a
					href={announcement.linkUrl}
					onClick={() => onLinkClick(announcement.id)}
					className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
					style={linkStyle}
				>
					{announcement.linkText ?? "Learn more"}
				</a>
			)}
			{announcement.isDismissible && (
				<button
					type="button"
					onClick={() => onDismiss(announcement.id)}
					aria-label="Dismiss announcement"
					className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			)}
		</div>
	);
}

export function AnnouncementBar({
	audience,
	position = "top",
}: {
	audience?: "all" | "authenticated" | "guest";
	position?: "top" | "bottom";
}) {
	const api = useAnnouncementsApi();
	const { getDismissed, addDismissed } = useDismissed();
	const dismissedRef = useRef<Set<string>>(new Set());
	const recordedRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		dismissedRef.current = getDismissed();
	}, [getDismissed]);

	const { data } = api.getActive.useQuery({
		query: { audience },
	}) as {
		data: { announcements: AnnouncementData[] } | undefined;
	};

	const impressionMutation = api.recordImpression.useMutation();
	const clickMutation = api.recordClick.useMutation();
	const dismissMutation = api.recordDismissal.useMutation();

	const announcements = (data?.announcements ?? []).filter(
		(a) =>
			a.type === "bar" &&
			a.position === position &&
			!dismissedRef.current.has(a.id),
	);

	useEffect(() => {
		for (const a of announcements) {
			if (!recordedRef.current.has(a.id)) {
				recordedRef.current.add(a.id);
				impressionMutation.mutate({ params: { id: a.id } });
			}
		}
	}, [announcements, impressionMutation]);

	const handleDismiss = useCallback(
		(id: string) => {
			addDismissed(id);
			dismissedRef.current.add(id);
			dismissMutation.mutate({ params: { id } });
		},
		[addDismissed, dismissMutation],
	);

	const handleLinkClick = useCallback(
		(id: string) => {
			clickMutation.mutate({ params: { id } });
		},
		[clickMutation],
	);

	if (announcements.length === 0) return null;

	return (
		<div className="w-full divide-y divide-white/20">
			{announcements.map((a) => (
				<AnnouncementBarItem
					key={a.id}
					announcement={a}
					onDismiss={handleDismiss}
					onLinkClick={handleLinkClick}
				/>
			))}
		</div>
	);
}
