"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useState } from "react";

function useAnnouncementsAdminApi() {
	const client = useModuleClient();
	const api = client.module("announcements").admin;
	return {
		createAnnouncement: api["/admin/announcements/create"],
		updateAnnouncement: api["/admin/announcements/:id/update"],
		getAnnouncement: api["/admin/announcements/:id"],
	};
}

const INPUT_CLASS =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1";
const SELECT_CLASS =
	"h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1";
const LABEL_CLASS = "mb-1 block font-medium text-foreground text-sm";

export function AnnouncementForm({ id }: { id?: string }) {
	const api = useAnnouncementsAdminApi();
	const isEdit = Boolean(id);

	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [type, setType] = useState<"bar" | "banner" | "popup">("bar");
	const [position, setPosition] = useState<"top" | "bottom">("top");
	const [linkUrl, setLinkUrl] = useState("");
	const [linkText, setLinkText] = useState("");
	const [backgroundColor, setBackgroundColor] = useState("");
	const [textColor, setTextColor] = useState("");
	const [isDismissible, setIsDismissible] = useState(true);
	const [targetAudience, setTargetAudience] = useState<
		"all" | "authenticated" | "guest"
	>("all");
	const [error, setError] = useState("");
	const [populated, setPopulated] = useState(!isEdit);

	const existingQuery = api.getAnnouncement.useQuery(
		{ params: { id: id ?? "" } },
		{ enabled: Boolean(id) },
	);

	useEffect(() => {
		if (populated) return;
		const a = existingQuery?.data?.announcement as
			| {
					title: string;
					content: string;
					type: "bar" | "banner" | "popup";
					position: "top" | "bottom";
					linkUrl?: string;
					linkText?: string;
					backgroundColor?: string;
					textColor?: string;
					isDismissible: boolean;
					targetAudience: "all" | "authenticated" | "guest";
			  }
			| undefined;
		if (!a) return;
		setTitle(a.title);
		setContent(a.content);
		setType(a.type);
		setPosition(a.position);
		setLinkUrl(a.linkUrl ?? "");
		setLinkText(a.linkText ?? "");
		setBackgroundColor(a.backgroundColor ?? "");
		setTextColor(a.textColor ?? "");
		setIsDismissible(a.isDismissible);
		setTargetAudience(a.targetAudience);
		setPopulated(true);
	}, [populated, existingQuery?.data?.announcement]);

	const createMutation = api.createAnnouncement.useMutation();
	const updateMutation = api.updateAnnouncement.useMutation();

	const isPending =
		createMutation.isPending || (isEdit && updateMutation.isPending);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		const body = {
			title,
			content,
			type,
			position,
			linkUrl: linkUrl.trim() || undefined,
			linkText: linkText.trim() || undefined,
			backgroundColor: backgroundColor.trim() || undefined,
			textColor: textColor.trim() || undefined,
			isDismissible,
			targetAudience,
		};

		try {
			if (isEdit && id && updateMutation) {
				await updateMutation.mutateAsync({ params: { id }, body });
				window.location.href = `/admin/announcements/${id}`;
			} else {
				const result = await createMutation.mutateAsync({ body });
				const created = result.announcement as { id: string };
				window.location.href = `/admin/announcements/${created.id}`;
			}
		} catch {
			setError(
				isEdit
					? "Failed to update announcement."
					: "Failed to create announcement.",
			);
		}
	}

	const isLoading = isEdit && existingQuery?.isLoading;

	return (
		<div>
			{/* Back link */}
			<a
				href="/admin/announcements"
				className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
			>
				← Announcements
			</a>

			{/* Header */}
			<div className="mb-6">
				<h1 className="text-balance font-bold text-2xl text-foreground">
					{isEdit ? "Edit Announcement" : "New Announcement"}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{isEdit
						? "Update the announcement details below."
						: "Configure a new announcement bar, banner, or popup."}
				</p>
			</div>

			<form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
				{/* Basic info */}
				<div className="space-y-4 rounded-lg border border-border bg-card p-6">
					<h2 className="font-semibold text-base text-foreground">Content</h2>

					<div>
						<label htmlFor="ann-title" className={LABEL_CLASS}>
							Title <span className="text-destructive">*</span>
						</label>
						{isLoading ? (
							<div className="h-10 animate-pulse rounded-lg bg-muted" />
						) : (
							<input
								id="ann-title"
								type="text"
								required
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Summer sale — free shipping on all orders"
								className={INPUT_CLASS}
							/>
						)}
					</div>

					<div>
						<label htmlFor="ann-content" className={LABEL_CLASS}>
							Message <span className="text-destructive">*</span>
						</label>
						{isLoading ? (
							<div className="h-20 animate-pulse rounded-lg bg-muted" />
						) : (
							<textarea
								id="ann-content"
								required
								value={content}
								onChange={(e) => setContent(e.target.value)}
								placeholder="Use code SAVE20 for 20% off your next order."
								rows={3}
								className={INPUT_CLASS}
							/>
						)}
					</div>
				</div>

				{/* Display settings */}
				<div className="space-y-4 rounded-lg border border-border bg-card p-6">
					<h2 className="font-semibold text-base text-foreground">Display</h2>

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="ann-type" className={LABEL_CLASS}>
								Type
							</label>
							{isLoading ? (
								<div className="h-10 animate-pulse rounded-lg bg-muted" />
							) : (
								<select
									id="ann-type"
									value={type}
									onChange={(e) =>
										setType(e.target.value as "bar" | "banner" | "popup")
									}
									className={SELECT_CLASS}
								>
									<option value="bar">Bar</option>
									<option value="banner">Banner</option>
									<option value="popup">Popup</option>
								</select>
							)}
						</div>

						<div>
							<label htmlFor="ann-position" className={LABEL_CLASS}>
								Position
							</label>
							{isLoading ? (
								<div className="h-10 animate-pulse rounded-lg bg-muted" />
							) : (
								<select
									id="ann-position"
									value={position}
									onChange={(e) =>
										setPosition(e.target.value as "top" | "bottom")
									}
									className={SELECT_CLASS}
								>
									<option value="top">Top</option>
									<option value="bottom">Bottom</option>
								</select>
							)}
						</div>
					</div>

					<div>
						<label htmlFor="ann-audience" className={LABEL_CLASS}>
							Target audience
						</label>
						{isLoading ? (
							<div className="h-10 animate-pulse rounded-lg bg-muted" />
						) : (
							<select
								id="ann-audience"
								value={targetAudience}
								onChange={(e) =>
									setTargetAudience(
										e.target.value as "all" | "authenticated" | "guest",
									)
								}
								className={SELECT_CLASS}
							>
								<option value="all">All visitors</option>
								<option value="authenticated">Logged-in users</option>
								<option value="guest">Guests only</option>
							</select>
						)}
					</div>

					<div className="flex items-center gap-3">
						{isLoading ? (
							<div className="size-4 animate-pulse rounded bg-muted" />
						) : (
							<input
								id="ann-dismissible"
								type="checkbox"
								checked={isDismissible}
								onChange={(e) => setIsDismissible(e.target.checked)}
								className="size-4 rounded border-input accent-primary"
							/>
						)}
						<label
							htmlFor="ann-dismissible"
							className="text-foreground text-sm"
						>
							Allow visitors to dismiss this announcement
						</label>
					</div>
				</div>

				{/* Link */}
				<div className="space-y-4 rounded-lg border border-border bg-card p-6">
					<h2 className="font-semibold text-base text-foreground">
						Link{" "}
						<span className="font-normal text-muted-foreground text-sm">
							(optional)
						</span>
					</h2>

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="ann-link-url" className={LABEL_CLASS}>
								URL
							</label>
							{isLoading ? (
								<div className="h-10 animate-pulse rounded-lg bg-muted" />
							) : (
								<input
									id="ann-link-url"
									type="url"
									value={linkUrl}
									onChange={(e) => setLinkUrl(e.target.value)}
									placeholder="https://example.com/sale"
									className={INPUT_CLASS}
								/>
							)}
						</div>

						<div>
							<label htmlFor="ann-link-text" className={LABEL_CLASS}>
								Link text
							</label>
							{isLoading ? (
								<div className="h-10 animate-pulse rounded-lg bg-muted" />
							) : (
								<input
									id="ann-link-text"
									value={linkText}
									onChange={(e) => setLinkText(e.target.value)}
									placeholder="Shop now →"
									className={INPUT_CLASS}
								/>
							)}
						</div>
					</div>
				</div>

				{/* Colors */}
				<div className="space-y-4 rounded-lg border border-border bg-card p-6">
					<h2 className="font-semibold text-base text-foreground">
						Colors{" "}
						<span className="font-normal text-muted-foreground text-sm">
							(optional — uses theme defaults when blank)
						</span>
					</h2>

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="ann-bg-color" className={LABEL_CLASS}>
								Background color
							</label>
							<div className="flex items-center gap-2">
								{isLoading ? (
									<div className="h-10 flex-1 animate-pulse rounded-lg bg-muted" />
								) : (
									<>
										<input
											id="ann-bg-color"
											value={backgroundColor}
											onChange={(e) => setBackgroundColor(e.target.value)}
											placeholder="#1a1a2e"
											className={`${INPUT_CLASS} font-mono`}
										/>
										{backgroundColor && (
											<span
												className="inline-block size-8 shrink-0 rounded-md border border-border"
												style={{ backgroundColor }}
												aria-hidden="true"
											/>
										)}
									</>
								)}
							</div>
						</div>

						<div>
							<label htmlFor="ann-text-color" className={LABEL_CLASS}>
								Text color
							</label>
							<div className="flex items-center gap-2">
								{isLoading ? (
									<div className="h-10 flex-1 animate-pulse rounded-lg bg-muted" />
								) : (
									<>
										<input
											id="ann-text-color"
											value={textColor}
											onChange={(e) => setTextColor(e.target.value)}
											placeholder="#ffffff"
											className={`${INPUT_CLASS} font-mono`}
										/>
										{textColor && (
											<span
												className="inline-block size-8 shrink-0 rounded-md border border-border"
												style={{ backgroundColor: textColor }}
												aria-hidden="true"
											/>
										)}
									</>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Actions */}
				{error && (
					<p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-destructive text-sm">
						{error}
					</p>
				)}

				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={isPending}
						className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
					>
						{isPending
							? isEdit
								? "Saving…"
								: "Creating…"
							: isEdit
								? "Save changes"
								: "Create announcement"}
					</button>
					<a
						href={
							isEdit && id
								? `/admin/announcements/${id}`
								: "/admin/announcements"
						}
						className="rounded-md border border-border px-5 py-2 text-foreground text-sm hover:bg-muted"
					>
						Cancel
					</a>
				</div>
			</form>
		</div>
	);
}
