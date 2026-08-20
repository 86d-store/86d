"use client";

export function BellIcon({ active }: { active: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 20 20"
			fill={active ? "currentColor" : "none"}
			stroke="currentColor"
			strokeWidth={active ? 0 : 1.5}
			className="h-4 w-4"
			aria-hidden="true"
		>
			<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
		</svg>
	);
}
