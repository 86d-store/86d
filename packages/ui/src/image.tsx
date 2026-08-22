"use client";

import NextImage from "next/image";
import type * as React from "react";

import { cn } from "~/lib/utils";

export function Image({
	className,
	...props
}: React.ComponentProps<typeof NextImage>) {
	return <NextImage data-slot="image" className={cn(className)} {...props} />;
}
