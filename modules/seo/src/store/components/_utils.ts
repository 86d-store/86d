export function formatDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function pathToTitle(path: string): string {
	const segment = path.split("/").filter(Boolean).pop() ?? "Home";
	return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
