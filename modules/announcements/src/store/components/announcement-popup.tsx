"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
	isDismissible: boolean;
}

const DISMISSED_KEY = "86d:dismissed-popups";

function getDismissedPopups(): Set<string> {
	try {
		const raw = localStorage.getItem(DISMISSED_KEY);
		return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
	} catch {
		return new Set();
	}
}

function addDismissedPopup(id: string) {
	try {
		const set = getDismissedPopups();
		set.add(id);
		localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
	} catch {
		// ignore
	}
}

export function AnnouncementPopup({
	audience,
	delayMs = 3000,
}: {
	audience?: "all" | "authenticated" | "guest";
	delayMs?: number;
}) {
	const api = useAnnouncementsApi();
	const [visible, setVisible] = useState<AnnouncementData | null>(null);
	const [shown, setShown] = useState(false);
	const recordedRef = useRef<Set<string>>(new Set());

	const { data } = api.getActive.useQuery({
		query: { audience },
	}) as {
		data: { announcements: AnnouncementData[] } | undefined;
	};

	const impressionMutation = api.recordImpression.useMutation();
	const clickMutation = api.recordClick.useMutation();
	const dismissMutation = api.recordDismissal.useMutation();

	useEffect(() => {
		if (shown || !data) return;
		const dismissed = getDismissedPopups();
		const popup = data.announcements.find(
			(a) => a.type === "popup" && !dismissed.has(a.id),
		);
		if (!popup) return;

		const timer = setTimeout(() => {
			setVisible(popup);
			setShown(true);
			if (!recordedRef.current.has(popup.id)) {
				recordedRef.current.add(popup.id);
				impressionMutation.mutate({ params: { id: popup.id } });
			}
		}, delayMs);

		return () => clearTimeout(timer);
	}, [data, shown, delayMs, impressionMutation]);

	const handleDismiss = useCallback(() => {
		if (!visible) return;
		addDismissedPopup(visible.id);
		dismissMutation.mutate({ params: { id: visible.id } });
		setVisible(null);
	}, [visible, dismissMutation]);

	useEffect(() => {
		if (!visible) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") handleDismiss();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [visible, handleDismiss]);

	const handleLinkClick = useCallback(() => {
		if (!visible) return;
		clickMutation.mutate({ params: { id: visible.id } });
	}, [visible, clickMutation]);

	if (!visible) return null;

	const hasCustomBg = Boolean(visible.backgroundColor);
	const wrapperStyle = hasCustomBg
		? {
				backgroundColor: visible.backgroundColor,
				color: visible.textColor ?? "#ffffff",
			}
		: undefined;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				className="absolute inset-0 bg-black/40"
				onClick={handleDismiss}
				aria-label="Close announcement"
			/>
			<div
				role="dialog"
				aria-modal="true"
				className={`relative z-10 w-full max-w-md rounded-2xl shadow-2xl ${
					hasCustomBg ? "" : "bg-card text-foreground"
				}`}
				style={wrapperStyle}
			>
				{visible.isDismissible && (
					<button
						type="button"
						onClick={handleDismiss}
						aria-label="Dismiss announcement"
						className="absolute top-4 right-4 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
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
				<div className="px-8 py-10 text-center">
					<h2 className="text-balance font-bold text-xl">{visible.title}</h2>
					<p className="mt-3 text-pretty text-sm opacity-80">
						{visible.content}
					</p>
					{visible.linkUrl && (
						<a
							href={visible.linkUrl}
							onClick={handleLinkClick}
							className={`mt-6 inline-block rounded-full px-6 py-2.5 font-medium text-sm transition-opacity hover:opacity-90 ${
								hasCustomBg
									? "bg-white/20 text-inherit"
									: "bg-foreground text-background"
							}`}
						>
							{visible.linkText ?? "Learn more"}
						</a>
					)}
				</div>
			</div>
		</div>
	);
}
