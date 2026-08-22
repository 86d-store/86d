"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/shadcn/button";

type ButtonProps = React.ComponentProps<typeof Button>;
type ButtonPointerEvent = Parameters<
	NonNullable<ButtonProps["onPointerDown"]>
>[0];
type ButtonKeyboardEvent = Parameters<NonNullable<ButtonProps["onKeyDown"]>>[0];
type ButtonFocusEvent = Parameters<NonNullable<ButtonProps["onBlur"]>>[0];
type ButtonMouseEvent = Parameters<
	NonNullable<ButtonProps["onContextMenu"]>
>[0];

export function isHoldFillComplete(
	event: {
		propertyName: string;
		target: unknown;
		currentTarget: unknown;
	},
	holding: boolean,
	confirmed: boolean,
): boolean {
	if (!holding || confirmed) {
		return false;
	}
	if (event.target !== event.currentTarget) {
		return false;
	}
	return (
		event.propertyName === "clip-path" || event.propertyName === "clippath"
	);
}

export interface HoldToConfirmButtonProps
	extends React.ComponentProps<typeof Button> {
	onConfirm: () => void;
}

export function HoldToConfirmButton({
	onConfirm,
	children = "Press and hold",
	className,
	variant = "destructive",
	disabled,
	onPointerDown,
	onPointerUp,
	onPointerCancel,
	onLostPointerCapture,
	onKeyDown,
	onKeyUp,
	onBlur,
	onContextMenu,
	...props
}: HoldToConfirmButtonProps) {
	const [holding, setHolding] = useState(false);
	const confirmedRef = useRef(false);

	const startHold = useCallback(() => {
		if (disabled) {
			return;
		}
		confirmedRef.current = false;
		setHolding(true);
	}, [disabled]);

	const endHold = useCallback(() => {
		setHolding(false);
	}, []);

	const handlePointerDown = useCallback(
		(event: ButtonPointerEvent) => {
			onPointerDown?.(event);
			if (event.defaultPrevented || event.button !== 0) {
				return;
			}
			event.currentTarget.setPointerCapture(event.pointerId);
			startHold();
		},
		[onPointerDown, startHold],
	);

	const handlePointerUp = useCallback(
		(event: ButtonPointerEvent) => {
			onPointerUp?.(event);
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			endHold();
		},
		[endHold, onPointerUp],
	);

	const handlePointerCancel = useCallback(
		(event: ButtonPointerEvent) => {
			onPointerCancel?.(event);
			endHold();
		},
		[endHold, onPointerCancel],
	);

	const handleLostPointerCapture = useCallback(
		(event: ButtonPointerEvent) => {
			onLostPointerCapture?.(event);
			endHold();
		},
		[endHold, onLostPointerCapture],
	);

	const handleKeyDown = useCallback(
		(event: ButtonKeyboardEvent) => {
			onKeyDown?.(event);
			if (event.defaultPrevented) {
				return;
			}
			if (event.key !== " " && event.key !== "Enter") {
				return;
			}
			event.preventDefault();
			if (!event.repeat) {
				startHold();
			}
		},
		[onKeyDown, startHold],
	);

	const handleKeyUp = useCallback(
		(event: ButtonKeyboardEvent) => {
			onKeyUp?.(event);
			if (event.key === " " || event.key === "Enter") {
				endHold();
			}
		},
		[endHold, onKeyUp],
	);

	const handleBlur = useCallback(
		(event: ButtonFocusEvent) => {
			onBlur?.(event);
			endHold();
		},
		[endHold, onBlur],
	);

	const handleContextMenu = useCallback(
		(event: ButtonMouseEvent) => {
			onContextMenu?.(event);
			if (!event.defaultPrevented) {
				event.preventDefault();
			}
		},
		[onContextMenu],
	);

	const handleTransitionEnd = useCallback(
		(event: React.TransitionEvent<HTMLSpanElement>) => {
			if (!isHoldFillComplete(event, holding, confirmedRef.current)) {
				return;
			}
			confirmedRef.current = true;
			setHolding(false);
			onConfirm();
		},
		[holding, onConfirm],
	);

	return (
		<Button
			{...props}
			data-slot="hold-to-confirm-button"
			data-holding={holding || undefined}
			variant={variant}
			disabled={disabled}
			className={cn(
				"relative touch-none transition-[scale] duration-150 ease-[var(--ease-out-strong)] [-webkit-touch-callout:none] data-holding:scale-[0.97] motion-reduce:data-holding:scale-100",
				className,
			)}
			onPointerDown={handlePointerDown}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onLostPointerCapture={handleLostPointerCapture}
			onKeyDown={handleKeyDown}
			onKeyUp={handleKeyUp}
			onBlur={handleBlur}
			onContextMenu={handleContextMenu}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			<span className="relative">{children}</span>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-destructive text-white transition-[clip-path] duration-200 ease-[var(--ease-out-strong)] [clip-path:inset(0_100%_0_0)] group-data-[holding]/button:duration-[2s] group-data-[holding]/button:ease-linear group-data-[holding]/button:[clip-path:inset(0_0_0_0)]"
				onTransitionEnd={handleTransitionEnd}
			>
				{children}
			</span>
		</Button>
	);
}
