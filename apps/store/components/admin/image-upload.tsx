"use client";

import { useCallback, useRef, useState } from "react";

interface ImageUploadProps {
	images: string[];
	onChange: (images: string[]) => void;
	max?: number;
	label?: string;
}

export function ImageUpload({
	images,
	onChange,
	max = 10,
	label = "Images",
}: ImageUploadProps) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const uploadFile = useCallback(async (file: File): Promise<string | null> => {
		const formData = new FormData();
		formData.append("file", file);

		const res = await fetch("/api/upload", {
			method: "POST",
			body: formData,
		});

		if (!res.ok) {
			const data = (await res.json()) as { error?: string };
			throw new Error(data.error ?? "Upload failed");
		}

		const data = (await res.json()) as { url: string };
		return data.url;
	}, []);

	const handleFiles = useCallback(
		async (files: FileList | File[]) => {
			const fileArray = Array.from(files);
			const remaining = max - images.length;

			if (remaining <= 0) {
				setError(`Maximum ${max} images allowed`);
				return;
			}

			const toUpload = fileArray.slice(0, remaining);
			setError(null);
			setUploading(true);

			try {
				const urls: string[] = [];
				for (const file of toUpload) {
					const url = await uploadFile(file);
					if (url) urls.push(url);
				}
				onChange([...images, ...urls]);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed");
			} finally {
				setUploading(false);
				if (inputRef.current) inputRef.current.value = "";
			}
		},
		[images, max, onChange, uploadFile],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			if (e.dataTransfer.files.length > 0) {
				void handleFiles(e.dataTransfer.files);
			}
		},
		[handleFiles],
	);

	const handleRemove = useCallback(
		(index: number) => {
			onChange(images.filter((_, i) => i !== index));
		},
		[images, onChange],
	);

	const handleReorder = useCallback(
		(fromIndex: number, toIndex: number) => {
			const updated = [...images];
			const [moved] = updated.splice(fromIndex, 1);
			updated.splice(toIndex, 0, moved);
			onChange(updated);
		},
		[images, onChange],
	);

	return (
		<div>
			<span className="mb-1.5 block font-medium text-foreground text-sm">
				{label}
			</span>

			{/* Existing images */}
			{images.length > 0 && (
				<div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
					{images.map((url, i) => (
						<div key={url} className="group relative">
							<div className="aspect-square overflow-hidden rounded-md border border-border bg-muted">
								<img
									src={url}
									alt={`Upload ${i + 1}`}
									className="h-full w-full object-cover"
								/>
							</div>
							<div className="absolute top-1 right-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
								{i > 0 && (
									<button
										type="button"
										onClick={() => handleReorder(i, i - 1)}
										className="rounded bg-background/80 p-0.5 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
										title="Move left"
									>
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
											<path d="m15 18-6-6 6-6" />
										</svg>
									</button>
								)}
								{i < images.length - 1 && (
									<button
										type="button"
										onClick={() => handleReorder(i, i + 1)}
										className="rounded bg-background/80 p-0.5 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
										title="Move right"
									>
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
											<path d="m9 18 6-6-6-6" />
										</svg>
									</button>
								)}
								<button
									type="button"
									onClick={() => handleRemove(i)}
									className="rounded bg-destructive/90 p-0.5 text-white shadow-sm backdrop-blur-sm hover:bg-destructive"
									title="Remove"
								>
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
										<path d="M18 6 6 18" />
										<path d="m6 6 12 12" />
									</svg>
								</button>
							</div>
							{i === 0 && (
								<span className="absolute bottom-1 left-1 rounded bg-foreground/80 px-1 py-0.5 font-medium text-2xs text-background backdrop-blur-sm">
									Primary
								</span>
							)}
						</div>
					))}
				</div>
			)}

			{/* Drop zone */}
			{images.length < max && (
				<button
					type="button"
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={handleDrop}
					className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
						dragOver
							? "border-foreground/50 bg-muted/50"
							: "border-border hover:border-muted-foreground hover:bg-muted/30"
					} ${uploading ? "pointer-events-none opacity-60" : ""}`}
					onClick={() => inputRef.current?.click()}
				>
					{uploading ? (
						<div className="flex items-center gap-2">
							<svg
								className="size-5 animate-spin text-muted-foreground"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
								/>
							</svg>
							<span className="text-muted-foreground text-sm">
								Uploading...
							</span>
						</div>
					) : (
						<>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="mb-2 text-muted-foreground"
								aria-hidden="true"
							>
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<polyline points="17 8 12 3 7 8" />
								<line x1="12" y1="3" x2="12" y2="15" />
							</svg>
							<p className="text-muted-foreground text-sm">
								Drop images here or click to browse
							</p>
							<p className="mt-1 text-muted-foreground/70 text-xs">
								JPEG, PNG, WebP up to 4.5 MB
							</p>
						</>
					)}
				</button>
			)}

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				multiple
				className="hidden"
				onChange={(e) => {
					if (e.target.files && e.target.files.length > 0) {
						void handleFiles(e.target.files);
					}
				}}
			/>

			{error && <p className="mt-1.5 text-destructive text-xs">{error}</p>}
		</div>
	);
}

// ─── Single image variant ────────────────────────────────────────────────────

interface SingleImageUploadProps {
	image: string | null;
	onChange: (image: string | null) => void;
	label?: string;
}

export function SingleImageUpload({
	image,
	onChange,
	label = "Image",
}: SingleImageUploadProps) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = async (file: File) => {
		setError(null);
		setUploading(true);
		try {
			const formData = new FormData();
			formData.append("file", file);
			const res = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			});
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				throw new Error(data.error ?? "Upload failed");
			}
			const data = (await res.json()) as { url: string };
			onChange(data.url);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	};

	return (
		<div>
			<span className="mb-1.5 block font-medium text-foreground text-sm">
				{label}
			</span>

			{image ? (
				<div className="group relative inline-block">
					<div className="h-24 w-24 overflow-hidden rounded-md border border-border bg-muted">
						<img
							src={image}
							alt="Uploaded"
							className="h-full w-full object-cover"
						/>
					</div>
					<button
						type="button"
						onClick={() => onChange(null)}
						className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-white shadow-sm hover:bg-destructive/80"
						title="Remove"
					>
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
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={uploading}
					className="flex h-24 w-24 flex-col items-center justify-center rounded-md border-2 border-border border-dashed text-muted-foreground transition-colors hover:border-muted-foreground hover:bg-muted/30 disabled:opacity-60"
				>
					{uploading ? (
						<svg
							className="size-5 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
					) : (
						<>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<rect width="18" height="18" x="3" y="3" rx="2" />
								<circle cx="9" cy="9" r="2" />
								<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
							</svg>
							<span className="mt-1 text-2xs">Upload</span>
						</>
					)}
				</button>
			)}

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) void handleFile(file);
				}}
			/>

			{error && <p className="mt-1.5 text-destructive text-xs">{error}</p>}
		</div>
	);
}
