"use client";

import { Skeleton as BoneyardSkeleton } from "boneyard-js/react";
import { useId } from "react";
import slugify from "slugify";
import { Skeleton as SkeletonPrimitive } from "~/core/skeleton";
import { cn } from "~/lib/utils";
import { View } from "~/view";

interface FixturePulseFallbackProps {
	fixture: React.ReactNode;
	pulseClassName: string;
}

function FixturePulseFallback({
	fixture,
	pulseClassName,
}: FixturePulseFallbackProps) {
	return (
		<View className="relative w-full overflow-hidden rounded-[inherit]">
			<View className="invisible w-full" aria-hidden>
				{fixture}
			</View>
			<SkeletonPrimitive
				className={cn(
					"pointer-events-none absolute inset-0 rounded-[inherit]",
					pulseClassName,
				)}
				aria-hidden
			/>
		</View>
	);
}

export type AsyncSkeletonProps = Omit<
	React.ComponentProps<typeof BoneyardSkeleton>,
	"name"
> & {
	name: string;
};

export function AsyncSkeleton({
	name,
	className = "",
	fallback,
	children,
	fixture,
	...props
}: AsyncSkeletonProps) {
	const id = useId();
	const safeName = String(name).toLowerCase().trim();
	const slug = slugify(safeName || id);

	const resolvedFallback =
		fallback ??
		(fixture != null ? (
			<FixturePulseFallback fixture={fixture} pulseClassName={className} />
		) : (
			<SkeletonPrimitive
				className={cn("min-h-[0.75rem] w-full", className)}
				aria-hidden
			/>
		));

	return (
		<BoneyardSkeleton
			name={slug}
			className={className}
			fixture={fixture}
			fallback={resolvedFallback}
			{...props}
		>
			{children}
		</BoneyardSkeleton>
	);
}
