export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / 1024 ** i;
	return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function isImageMimeType(mimeType: string): boolean {
	return mimeType.startsWith("image/");
}

export function isVideoMimeType(mimeType: string): boolean {
	return mimeType.startsWith("video/");
}

export function assetLabel(mimeType: string): string {
	if (isImageMimeType(mimeType)) return "Image";
	if (isVideoMimeType(mimeType)) return "Video";
	if (mimeType === "application/pdf") return "PDF";
	return "File";
}
