"use client";

import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import type React from "react";
import { Fragment } from "react";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shadcn/tooltip";

dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

export interface TimeAgoProps {
	date?: dayjs.ConfigType;
	className?: string;
	side?: React.ComponentProps<typeof TooltipContent>["side"];
	align?: React.ComponentProps<typeof TooltipContent>["align"];
	alignOffset?: React.ComponentProps<typeof TooltipContent>["alignOffset"];
	sideOffset?: React.ComponentProps<typeof TooltipContent>["sideOffset"];
}

export function TimeAgo({
	date,
	className,
	side = "top",
	align = "center",
	alignOffset = 0,
	sideOffset = 8,
}: TimeAgoProps) {
	if (!date) {
		return <Fragment key="location">&mdash;</Fragment>;
	}
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<span
						role="tooltip"
						className={cn("focus:outline-none", className)}
					/>
				}
			>
				{dayjs(date).locale("en").fromNow()}
			</TooltipTrigger>
			<TooltipContent
				side={side}
				align={align}
				alignOffset={alignOffset}
				sideOffset={sideOffset}
			>
				{dayjs(date).locale("en").format("llll")}
			</TooltipContent>
		</Tooltip>
	);
}
