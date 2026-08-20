"use client";

import { useState } from "react";
import { usePhotoBoothStoreApi } from "./_hooks";
import PhotoGalleryTemplate from "./photo-gallery.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface Photo {
	id: string;
	imageUrl: string;
	thumbnailUrl?: string | undefined;
	caption?: string | undefined;
	tags: string[];
	isPublic: boolean;
	createdAt: string;
}

// ── PhotoGallery ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;

export function PhotoGallery() {
	const api = usePhotoBoothStoreApi();
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<Photo | null>(null);
	const [sendEmail, setSendEmail] = useState("");
	const [sendPhone, setSendPhone] = useState("");
	const [sendError, setSendError] = useState<string | null>(null);
	const [sendSuccess, setSendSuccess] = useState(false);

	const photosQuery = api.listPhotos.useQuery({
		page: String(page),
		limit: String(PAGE_SIZE),
	}) as {
		data: { photos?: Photo[] } | undefined;
		isLoading: boolean;
	};

	const sendMutation = api.send.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<{
			error?: string;
		}>;
		isPending: boolean;
	};

	const photos = photosQuery.data?.photos ?? [];
	const hasMore = photos.length === PAGE_SIZE;

	async function handleSend(e: React.FormEvent) {
		e.preventDefault();
		if (!selected) return;
		setSendError(null);
		setSendSuccess(false);
		if (!sendEmail.trim() && !sendPhone.trim()) {
			setSendError("Enter an email or phone number.");
			return;
		}
		try {
			const body: Record<string, unknown> = { photoId: selected.id };
			if (sendEmail.trim()) body.email = sendEmail.trim();
			if (sendPhone.trim()) body.phoneNumber = sendPhone.trim();
			const result = await sendMutation.mutateAsync({ body });
			if (result.error) {
				setSendError(result.error);
			} else {
				setSendSuccess(true);
				setSendEmail("");
				setSendPhone("");
			}
		} catch {
			setSendError("Failed to send photo. Please try again.");
		}
	}

	return (
		<PhotoGalleryTemplate
			isLoading={photosQuery.isLoading}
			photos={photos}
			page={page}
			hasMore={hasMore}
			selected={selected}
			sendEmail={sendEmail}
			sendPhone={sendPhone}
			sendError={sendError}
			sendSuccess={sendSuccess}
			isSending={sendMutation.isPending}
			onSelect={setSelected}
			onClose={() => {
				setSelected(null);
				setSendError(null);
				setSendSuccess(false);
				setSendEmail("");
				setSendPhone("");
			}}
			onSend={handleSend}
			onSendEmailChange={setSendEmail}
			onSendPhoneChange={setSendPhone}
			onNextPage={() => setPage((p) => p + 1)}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
		/>
	);
}
