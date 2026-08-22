"use client";

import { Slot } from "@radix-ui/react-slot";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { View } from "~/view";

export interface ContentEditableProps
	extends React.ComponentProps<typeof View> {
	defaultValue?: string;
	name?: string;
	onSave: (value: string) => Promise<unknown>;
	children: React.ReactNode;
	debounceMs?: number;
}

export function ContentEditable({
	className,
	defaultValue: defaultValueProp,
	name = "value",
	onSave,
	children,
	debounceMs = 500,
	...divProps
}: ContentEditableProps) {
	const defaultValue = defaultValueProp ?? String(children);

	const [value, setValue] = useState(defaultValue);
	const [pending, setPending] = useState(false);
	const lastSubmittedValue = useRef(defaultValue);

	const save = useCallback(
		async (nextValue: string) => {
			if (nextValue === lastSubmittedValue.current || pending) return;

			const previousValue = lastSubmittedValue.current;
			lastSubmittedValue.current = nextValue;
			setPending(true);

			try {
				await onSave(nextValue);
			} catch (error) {
				console.error(error);
				lastSubmittedValue.current = previousValue;
				toast.error("Failed to save changes", {
					description: error instanceof Error ? error.message : undefined,
				});
			} finally {
				setPending(false);
			}
		},
		[onSave, pending],
	);

	const handleInput = (e: React.FormEvent<HTMLElement>) => {
		const nextValue = e.currentTarget.textContent ?? "";
		setValue(nextValue);
	};

	const handleBlur = () => {
		if (value !== lastSubmittedValue.current) {
			void save(value);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
			(e.currentTarget as HTMLElement).blur();
		} else if (e.key === "Escape") {
			e.preventDefault();
			setValue(lastSubmittedValue.current);
			(e.currentTarget as HTMLElement).textContent = lastSubmittedValue.current;
			(e.currentTarget as HTMLElement).blur();
		}
	};

	return (
		<View {...divProps} className={cn("flex items-center gap-1", className)}>
			<Slot
				contentEditable={!pending}
				suppressContentEditableWarning
				spellCheck={false}
				role="textbox"
				aria-label={name}
				aria-readonly={pending}
				onInput={handleInput}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				className="rounded-sm shadow-none! outline-none! focus-visible:border-0! focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0!"
			>
				{children}
			</Slot>
		</View>
	);
}
