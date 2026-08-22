"use client";

import LinkPrimitive from "next/link";
import type * as React from "react";

export function Link(props: React.ComponentProps<typeof LinkPrimitive>) {
	return <LinkPrimitive {...props} />;
}
