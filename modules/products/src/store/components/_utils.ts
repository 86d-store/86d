/** Extract a URL string from an image entry (handles both string and {url,alt} formats). */
export function imageUrl(img: unknown): string {
	if (typeof img === "string") return img;
	if (img && typeof img === "object" && "url" in img)
		return String((img as { url: string }).url);
	return "";
}

export function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

export function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}
