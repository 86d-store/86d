"use client";

import StarDisplayTemplate from "./star-display.mdx";

export interface StarDisplayProps {
	rating: number;
	size?: "sm" | "md" | "lg";
}

export function StarDisplay({ rating, size = "md" }: StarDisplayProps) {
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
