"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import { useState } from "react";
import PhotoBoothAdminTemplate from "./photo-booth-admin.mdx";

interface PhotoSession {
	id: string;
	name: string;
	description?: string;
	isActive: boolean;
	photoCount: number;
	startedAt: string;
	endedAt?: string;
	createdAt: string;
}

interface Photo {
	id: string;
	sessionId: string;
	imageUrl: string;
	thumbnailUrl?: string;
	caption?: string;
	email?: string;
	isPublic: boolean;
	sendStatus: string;
	createdAt: string;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "body" in err) {
		const body = (err as { body: { message?: string } }).body;
		return body.message ?? "An error occurred";
	}
	return "An error occurred";
}

const STATUS_COLORS: Record<string, string> = {
	pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	sent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
	none: "bg-muted text-muted-foreground",
};

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function usePhotoBoothApi() {
	const client = useModuleClient();
	const api = client.module("photo-booth").admin;
	return {
		listSessions: api["/admin/photo-booth/sessions"],
		createSession: api["/admin/photo-booth/sessions/create"],
		endSession: api["/admin/photo-booth/sessions/:id/end"],
		listPhotos: api["/admin/photo-booth/photos"],
		deletePhoto: api["/admin/photo-booth/photos/:id/delete"],
	};
}

export function PhotoBoothAdmin() {
	const api = usePhotoBoothApi();
	const [activeTab, setActiveTab] = useState<"sessions" | "photos">("sessions");
	const [sessionSkip, setSessionSkip] = useState(0);
	const [photoSkip, setPhotoSkip] = useState(0);
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [error, setError] = useState("");
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	const { data: sessionsData, isLoading: sessionsLoading } =
		api.listSessions.useQuery({
			limit: String(PAGE_SIZE),
			page: String(Math.floor(sessionSkip / PAGE_SIZE) + 1),
		}) as {
			data: { sessions: PhotoSession[]; total: number } | undefined;
			isLoading: boolean;
		};

	const { data: photosData, isLoading: photosLoading } =
		api.listPhotos.useQuery({
			limit: String(PAGE_SIZE),
			page: String(Math.floor(photoSkip / PAGE_SIZE) + 1),
		}) as {
			data: { photos: Photo[]; total: number } | undefined;
			isLoading: boolean;
		};

	const sessions = sessionsData?.sessions ?? [];
	const sessionTotal = sessionsData?.total ?? 0;
	const photos = photosData?.photos ?? [];
	const photoTotal = photosData?.total ?? 0;

	const activeSessions = sessions.filter((s) => s.isActive).length;
	const totalPhotos = sessions.reduce((sum, s) => sum + s.photoCount, 0);

	const createMutation = api.createSession.useMutation({
		onSettled: () => void api.listSessions.invalidate(),
		onError: (err: Error) => setError(extractError(err)),
	});

	const endMutation = api.endSession.useMutation({
		onSettled: () => void api.listSessions.invalidate(),
		onError: (err: Error) => setError(extractError(err)),
	});

	const deleteMutation = api.deletePhoto.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.listPhotos.invalidate();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const handleCreate = () => {
		if (!newName.trim()) return;
		setError("");
		createMutation.mutate({
			name: newName.trim(),
			description: newDescription.trim() || undefined,
		});
		setNewName("");
		setNewDescription("");
		setShowCreate(false);
	};

	const handleEndSession = (id: string) => {
		setError("");
		endMutation.mutate({ params: { id } });
	};

	const handleDeletePhoto = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const summaryCards = (
		<div className="grid gap-4 sm:grid-cols-3">
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Total Sessions
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatNumber(sessionTotal)}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Active Sessions
				</p>
				<p className="mt-1 font-semibold text-2xl text-emerald-600 dark:text-emerald-400">
					{formatNumber(activeSessions)}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Total Photos
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatNumber(totalPhotos)}
				</p>
			</div>
		</div>
	);

	const sessionsContent = sessionsLoading ? (
		<div className="divide-y divide-border">
			{Array.from({ length: 4 }, (_, i) => `skel-${i}`).map((key) => (
				<div key={key} className="flex items-center justify-between px-5 py-3">
					<div className="flex-1 space-y-1.5">
						<Skeleton className="h-4 w-40 rounded" />
						<Skeleton className="h-3 w-28 rounded" />
					</div>
					<Skeleton className="h-6 w-16 rounded-full" />
				</div>
			))}
		</div>
	) : sessions.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No sessions yet. Create your first photo booth session.
		</div>
	) : (
		<>
			<div className="divide-y divide-border">
				{sessions.map((session) => (
					<div
						key={session.id}
						className="flex items-center justify-between px-5 py-3"
					>
						<div>
							<p className="font-medium text-foreground text-sm">
								{session.name}
							</p>
							{session.description && (
								<p className="mt-0.5 text-muted-foreground text-xs">
									{session.description}
								</p>
							)}
							<p className="mt-0.5 text-muted-foreground text-xs">
								{formatNumber(session.photoCount)} photos &middot; Started{" "}
								{formatDate(session.startedAt)}
								{session.endedAt &&
									` &middot; Ended ${formatDate(session.endedAt)}`}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<span
								className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${
									session.isActive
										? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
										: "bg-muted text-muted-foreground"
								}`}
							>
								{session.isActive ? "Active" : "Ended"}
							</span>
							{session.isActive && (
								<button
									type="button"
									onClick={() => handleEndSession(session.id)}
									className="rounded border border-border px-2 py-0.5 text-muted-foreground text-xs hover:bg-muted"
								>
									End
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			{sessionTotal > PAGE_SIZE && (
				<div className="flex items-center justify-between border-border border-t px-5 py-3">
					<span className="text-muted-foreground text-sm">
						Showing {sessionSkip + 1}&ndash;
						{Math.min(sessionSkip + PAGE_SIZE, sessionTotal)} of {sessionTotal}
					</span>
					<span className="space-x-2">
						<button
							type="button"
							onClick={() => setSessionSkip((s) => Math.max(0, s - PAGE_SIZE))}
							disabled={sessionSkip === 0}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => setSessionSkip((s) => s + PAGE_SIZE)}
							disabled={sessionSkip + PAGE_SIZE >= sessionTotal}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Next
						</button>
					</span>
				</div>
			)}
		</>
	);

	const photosContent = photosLoading ? (
		<div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
			{Array.from({ length: 8 }, (_, i) => `skel-${i}`).map((key) => (
				<Skeleton key={key} className="aspect-square rounded-lg" />
			))}
		</div>
	) : photos.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No photos captured yet.
		</div>
	) : (
		<>
			<div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
				{photos.map((photo) => (
					<div key={photo.id} className="group relative">
						<div className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
							<Image
								src={photo.thumbnailUrl ?? photo.imageUrl}
								alt={photo.caption ?? "Photo"}
								width={400}
								height={400}
								unoptimized
								className="h-full w-full object-cover"
							/>
						</div>
						<div className="mt-1.5">
							{photo.caption && (
								<p className="truncate font-medium text-foreground text-xs">
									{photo.caption}
								</p>
							)}
							<div className="flex items-center justify-between">
								<span
									className={`inline-block rounded-full px-1.5 py-0.5 font-medium text-[10px] ${STATUS_COLORS[photo.sendStatus] ?? STATUS_COLORS.none}`}
								>
									{photo.sendStatus}
								</span>
								{deleteConfirm === photo.id ? (
									<span className="space-x-1">
										<button
											type="button"
											onClick={() => handleDeletePhoto(photo.id)}
											className="font-medium text-[10px] text-destructive"
										>
											Confirm
										</button>
										<button
											type="button"
											onClick={() => setDeleteConfirm(null)}
											className="text-[10px] text-muted-foreground"
										>
											Cancel
										</button>
									</span>
								) : (
									<button
										type="button"
										onClick={() => setDeleteConfirm(photo.id)}
										className="text-[10px] text-muted-foreground hover:text-destructive"
									>
										Delete
									</button>
								)}
							</div>
						</div>
					</div>
				))}
			</div>

			{photoTotal > PAGE_SIZE && (
				<div className="flex items-center justify-between border-border border-t px-5 py-3">
					<span className="text-muted-foreground text-sm">
						Showing {photoSkip + 1}&ndash;
						{Math.min(photoSkip + PAGE_SIZE, photoTotal)} of {photoTotal}
					</span>
					<span className="space-x-2">
						<button
							type="button"
							onClick={() => setPhotoSkip((s) => Math.max(0, s - PAGE_SIZE))}
							disabled={photoSkip === 0}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => setPhotoSkip((s) => s + PAGE_SIZE)}
							disabled={photoSkip + PAGE_SIZE >= photoTotal}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Next
						</button>
					</span>
				</div>
			)}
		</>
	);

	return (
		<PhotoBoothAdminTemplate
			summaryCards={summaryCards}
			error={error}
			activeTab={activeTab}
			onTabChange={setActiveTab}
			showCreate={showCreate}
			onToggleCreate={() => setShowCreate((v) => !v)}
			newName={newName}
			onNewNameChange={setNewName}
			newDescription={newDescription}
			onNewDescriptionChange={setNewDescription}
			onCreate={handleCreate}
			sessionsContent={sessionsContent}
			photosContent={photosContent}
		/>
	);
}
