"use client";

import { CalendarBlankIcon as CalendarIcon } from "@phosphor-icons/react/dist/ssr";
import { format } from "date-fns";
import { type HTMLAttributes, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "~/button";
import type { DatePreset } from "~/data-table-filters/components/data-table/types";
import { presets as defaultPresets } from "~/data-table-filters/constants/date-preset";
import { useDebounce } from "~/data-table-filters/hooks/use-debounce";
import { cn } from "~/lib/utils";
import { Calendar } from "~/shadcn/calendar";
import { Input } from "~/shadcn/input";
import { Kbd } from "~/shadcn/kbd";
import { Label } from "~/shadcn/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/shadcn/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "~/shadcn/select";
import { Separator } from "~/shadcn/separator";

interface DatePickerWithRangeProps extends HTMLAttributes<HTMLDivElement> {
	date: DateRange | undefined;
	setDate: (date: DateRange | undefined) => void;
	presets?: DatePreset[];
}

export function DatePickerWithRange({
	className,
	date,
	setDate,
	presets = defaultPresets,
}: DatePickerWithRangeProps) {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (!open) return;

			for (const preset of presets) {
				if (preset.shortcut === e.key) {
					setDate({ from: preset.from, to: preset.to });
				}
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [setDate, presets, open]);

	return (
		<div className={cn("grid gap-2", className)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button
							id="date"
							variant="outline"
							className={cn(
								"max-w-full justify-start truncate text-left font-normal shadow-none hover:bg-muted/50",
								!date && "text-muted-foreground",
							)}
						/>
					}
				>
					<CalendarIcon className="h-4 w-4" />
					{date?.from ? (
						date.to ? (
							<span className="truncate">
								{format(date.from, "LLL dd, y")} -{" "}
								{format(date.to, "LLL dd, y")}
							</span>
						) : (
							format(date.from, "LLL dd, y")
						)
					) : (
						<span>Pick a date</span>
					)}
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<div className="flex flex-col justify-between sm:flex-row">
						<div className="hidden sm:block">
							<DatePresets
								onSelect={setDate}
								selected={date}
								presets={presets}
							/>
						</div>
						<div className="block p-3 sm:hidden">
							<DatePresetsSelect
								onSelect={setDate}
								selected={date}
								presets={presets}
							/>
						</div>
						<Separator orientation="vertical" className="h-auto w-px" />
						<Calendar
							// `initialFocus` until react-day-picker 9 deprecated it; gone in
							// 10, which is what shadcn's `calendar` installs today.
							autoFocus
							mode="range"
							defaultMonth={date?.from ?? new Date()}
							selected={date}
							onSelect={setDate}
							numberOfMonths={1}
						/>
					</div>
					<Separator />
					<CustomDateRange onSelect={setDate} selected={date} />
				</PopoverContent>
			</Popover>
		</div>
	);
}

function DatePresets({
	selected,
	onSelect,
	presets,
}: {
	selected: DateRange | undefined;
	onSelect: (date: DateRange | undefined) => void;
	presets: DatePreset[];
}) {
	return (
		<div className="flex flex-col gap-2 p-3">
			<p className="mx-3 text-muted-foreground text-xs uppercase">Date Range</p>
			<div className="grid gap-1">
				{presets.map(({ label, shortcut, from, to }) => {
					const isActive = selected?.from === from && selected?.to === to;
					return (
						<Button
							key={label}
							variant={isActive ? "outline" : "ghost"}
							onClick={() => onSelect({ from, to })}
							className={cn(
								"flex items-center justify-between gap-6",
								!isActive && "border border-transparent!",
							)}
						>
							<span className="mr-auto">{label}</span>
							<Kbd className="uppercase">{shortcut}</Kbd>
						</Button>
					);
				})}
			</div>
		</div>
	);
}

function DatePresetsSelect({
	selected,
	onSelect,
	presets,
}: {
	selected: DateRange | undefined;
	onSelect: (date: DateRange | undefined) => void;
	presets: DatePreset[];
}) {
	const [value, setValue] = useState<string | undefined>(
		() =>
			presets.find((p) => p.from === selected?.from && p.to === selected?.to)
				?.shortcut,
	);

	useEffect(() => {
		const preset = presets.find(
			(p) => p.from === selected?.from && p.to === selected?.to,
		)?.shortcut;
		if (preset === value) return;
		setValue(preset);
	}, [selected, presets, value]);

	return (
		<Select
			value={value}
			onValueChange={(v) => {
				const preset = presets.find((p) => p.shortcut === v);
				if (preset) {
					onSelect({ from: preset.from, to: preset.to });
				}
			}}
		>
			{/* REMINDER: the label is rendered here rather than through the select
          value's placeholder. Base UI has no `placeholder` prop there — it
          reads the label off the root's `items` array — and `placeholder` is a
          valid HTML attribute, so passing it typechecks and then renders an
          empty trigger. Picking the muted colour by hand keeps the placeholder
          looking the same on both libraries. */}
			<SelectTrigger className={cn(!value && "text-muted-foreground")}>
				{presets.find((preset) => preset.shortcut === value)?.label ??
					"Date Presets"}
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>Date Presets</SelectLabel>
					{presets.map(({ label, shortcut }) => {
						return (
							<SelectItem
								key={label}
								value={shortcut}
								className="flex items-center justify-between [&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:justify-between"
							>
								<span>{label}</span>
								<Kbd className="ml-2 uppercase">{shortcut}</Kbd>
							</SelectItem>
						);
					})}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

// REMINDER: We can add min max date range validation https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local#setting_maximum_and_minimum_dates_and_times
function CustomDateRange({
	selected,
	onSelect,
}: {
	selected: DateRange | undefined;
	onSelect: (date: DateRange | undefined) => void;
}) {
	const [dateFrom, setDateFrom] = useState<Date | undefined>(selected?.from);
	const [dateTo, setDateTo] = useState<Date | undefined>(selected?.to);
	const debounceDateFrom = useDebounce(dateFrom, 1000);
	const debounceDateTo = useDebounce(dateTo, 1000);

	const formatDateForInput = (date: Date | undefined): string => {
		if (!date) return "";
		const utcDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
		return utcDate.toISOString().slice(0, 16);
	};

	useEffect(() => {
		onSelect({ from: debounceDateFrom, to: debounceDateTo });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debounceDateFrom, debounceDateTo, onSelect]);

	return (
		<div className="flex flex-col gap-2 p-3">
			<p className="text-muted-foreground text-xs uppercase">Custom Range</p>
			<div className="grid gap-2 sm:grid-cols-2">
				<div className="grid w-full gap-1.5">
					<Label htmlFor="from">Start</Label>
					<Input
						key={formatDateForInput(selected?.from)}
						type="datetime-local"
						id="from"
						name="from"
						defaultValue={formatDateForInput(selected?.from)}
						onChange={(e) => {
							const newDate = new Date(e.target.value);
							if (!Number.isNaN(newDate.getTime())) {
								setDateFrom(newDate);
							}
						}}
						disabled={!selected?.from}
					/>
				</div>
				<div className="grid w-full gap-1.5">
					<Label htmlFor="to">End</Label>
					<Input
						key={formatDateForInput(selected?.to)}
						type="datetime-local"
						id="to"
						name="to"
						defaultValue={formatDateForInput(selected?.to)}
						onChange={(e) => {
							const newDate = new Date(e.target.value);
							if (!Number.isNaN(newDate.getTime())) {
								setDateTo(newDate);
							}
						}}
						disabled={!selected?.to}
					/>
				</div>
			</div>
		</div>
	);
}
