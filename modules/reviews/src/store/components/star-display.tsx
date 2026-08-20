"use client";

import StarDisplayTemplate from "./star-display.mdx";

export function StarDisplay({
	rating,
	size = "md",
}: {
	rating: number;
	size?: "sm" | "md" | "lg";
}) {
	const sizeClass =
		size === "sm"
			? "text-sm select-none leading-none"
			: size === "lg"
				? "text-xl select-none leading-none"
				: "text-base select-none leading-none";
	const filledCount = Math.round(rating);
	const ariaLabel = `${rating} out of 5 stars`;

	return (
		<StarDisplayTemplate
			sizeClass={sizeClass}
			ariaLabel={ariaLabel}
			filledCount={filledCount}
		/>
	);
}
