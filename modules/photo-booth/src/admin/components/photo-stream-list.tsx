"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import { useState } from "react";
import PhotoStreamListTemplate from "./photo-stream-list.mdx";

interface PhotoStream {
	id: string;
	name: string;
	isLive: boolean;
	photoCount: number;
	createdAt: string;
	updatedAt: string;
}

interface Photo {
	id: string;
	imageUrl: string;
	thumbnailUrl?: string;
	caption?: string;
	createdAt: string;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
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

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useStreamApi() {
	const client = useModuleClient();
	const api = client.module("photo-booth").admin;
	return {
		listStreams: api["/admin/photo-booth/streams"],
		createStream: api["/admin/photo-booth/streams/create"],
		toggleStream: api["/admin/photo-booth/streams/:id/toggle"],
		streamPhotos: api["/admin/photo-booth/streams/:id/photos"],
	};
}

export function PhotoStreamList() {
	const api = useStreamApi();
	const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [error, setError] = useState("");
	const [photoSkip, setPhotoSkip] = useState(0);

	const { data: streamsData, isLoading: streamsLoading } =
		api.listStreams.useQuery({ limit: "100" }) as {
			data: { streams: PhotoStream[]; total: number } | undefined;
			isLoading: boolean;
		};

	const streams = streamsData?.streams ?? [];

	const { data: photosData, isLoading: photosLoading } =
		api.streamPhotos.useQuery(
			selectedStreamId
				? {
						params: { id: selectedStreamId },
						limit: String(PAGE_SIZE),
						page: String(Math.floor(photoSkip / PAGE_SIZE) + 1),
					}
				: null,
		) as {
			data: { photos: Photo[]; total: number } | undefined;
			isLoading: boolean;
		};

	const photos = photosData?.photos ?? [];
	const photoTotal = photosData?.total ?? 0;

	const createMutation = api.createStream.useMutation({
		onSettled: () => void api.listStreams.invalidate(),
		onError: (err: Error) => setError(extractError(err)),
	});

	const toggleMutation = api.toggleStream.useMutation({
		onSettled: () => void api.listStreams.invalidate(),
		onError: (err: Error) => setError(extractError(err)),
	});

	const handleCreate = () => {
		if (!newName.trim()) return;
		setError("");
		createMutation.mutate({ name: newName.trim() });
		setNewName("");
		setShowCreate(false);
	};

	const handleToggle = (id: string) => {
		setError("");
		toggleMutation.mutate({ params: { id } });
	};

	const selectedStream = streams.find((s) => s.id === selectedStreamId);

	const streamListContent = streamsLoading ? (
		<div className="divide-y divide-border">
			{Array.from({ length: 4 }, (_, i) => `skel-${i}`).map((key) => (
				<div key={key} className="flex items-center justify-between px-5 py-3">
					<div className="flex-1 space-y-1.5">
						<Skeleton className="h-4 w-32 rounded" />
						<Skeleton className="h-3 w-20 rounded" />
					</div>
					<Skeleton className="h-6 w-12 rounded-full" />
				</div>
			))}
		</div>
	) : streams.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No photo streams yet. Create one to start sharing photos live.
		</div>
	) : (
		<div className="divide-y divide-border">
			{streams.map((stream) => (
				<button
					key={stream.id}
					type="button"
					onClick={() => {
						setSelectedStreamId(stream.id);
						setPhotoSkip(0);
					}}
					className={`flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/20 ${selectedStreamId === stream.id ? "bg-muted/30" : ""}`}
				>
					<div>
						<p className="font-medium text-foreground text-sm">{stream.name}</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{formatNumber(stream.photoCount)} photos &middot;{" "}
							{formatDate(stream.createdAt)}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<span
							className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${
								stream.isLive
									? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
									: "bg-muted text-muted-foreground"
							}`}
						>
							{stream.isLive ? "Live" : "Offline"}
						</span>
					</div>
				</button>
			))}
		</div>
	);

	const detailContent = selectedStream ? (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-foreground text-lg">
						{selectedStream.name}
					</h3>
					<p className="text-muted-foreground text-sm">
						{formatNumber(selectedStream.photoCount)} photos
					</p>
				</div>
				<button
					type="button"
					onClick={() => handleToggle(selectedStream.id)}
					className={`rounded px-3 py-1 font-medium text-xs ${
						selectedStream.isLive
							? "bg-muted text-muted-foreground hover:bg-muted/80"
							: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-300"
					}`}
				>
					{selectedStream.isLive ? "Go Offline" : "Go Live"}
				</button>
			</div>

			{photosLoading ? (
				<div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
					{Array.from({ length: 6 }, (_, i) => `skel-${i}`).map((key) => (
						<Skeleton key={key} className="aspect-square rounded-lg" />
					))}
				</div>
			) : photos.length === 0 ? (
				<div className="py-8 text-center text-muted-foreground text-sm">
					No photos in this stream yet.
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
								{photo.caption && (
									<p className="mt-1 truncate text-muted-foreground text-xs">
										{photo.caption}
									</p>
								)}
							</div>
						))}
					</div>

					{photoTotal > PAGE_SIZE && (
						<div className="flex items-center justify-between pt-2">
							<span className="text-muted-foreground text-sm">
								{photoSkip + 1}&ndash;
								{Math.min(photoSkip + PAGE_SIZE, photoTotal)} of {photoTotal}
							</span>
							<span className="space-x-2">
								<button
									type="button"
									onClick={() =>
										setPhotoSkip((s) => Math.max(0, s - PAGE_SIZE))
									}
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
			)}
		</div>
	) : (
		<div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
			Select a stream to view its photos.
		</div>
	);

	return (
		<PhotoStreamListTemplate
			error={error}
			showCreate={showCreate}
			onToggleCreate={() => setShowCreate((v) => !v)}
			newName={newName}
			onNewNameChange={setNewName}
			onCreate={handleCreate}
			streamListContent={streamListContent}
			detailContent={detailContent}
		/>
	);
}
