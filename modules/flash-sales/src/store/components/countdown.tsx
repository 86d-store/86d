"use client";

import { useEffect, useState } from "react";
import { getTimeRemaining } from "./_utils";

export interface CountdownProps {
	endsAt: string | Date;
	label?: string;
	onExpire?: () => void;
}

export function Countdown({ endsAt, label, onExpire }: CountdownProps) {
	const [time, setTime] = useState(() => getTimeRemaining(endsAt));

	useEffect(() => {
		const tick = () => {
			const next = getTimeRemaining(endsAt);
			setTime(next);
			if (next.expired) {
				onExpire?.();
			}
		};
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [endsAt, onExpire]);

	if (time.expired) {
		return (
			<div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
				Sale ended
			</div>
		);
	}

	const segments: Array<{ value: number; unit: string }> = [];
	if (time.days > 0) segments.push({ value: time.days, unit: "d" });
	segments.push(
		{ value: time.hours, unit: "h" },
		{ value: time.minutes, unit: "m" },
		{ value: time.seconds, unit: "s" },
	);

	return (
		<div className="inline-flex items-center gap-1.5">
			{label && <span className="text-muted-foreground text-xs">{label}</span>}
			<div className="inline-flex items-center gap-0.5">
				{segments.map(({ value, unit }) => (
					<span
						key={unit}
						className="inline-flex items-baseline gap-px rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-foreground text-xs tabular-nums"
					>
						{String(value).padStart(2, "0")}
						<span className="text-2xs text-muted-foreground">{unit}</span>
					</span>
				))}
			</div>
		</div>
	);
}
