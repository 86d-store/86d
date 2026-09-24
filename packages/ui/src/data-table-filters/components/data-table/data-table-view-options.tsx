"use client";

import {
	CheckIcon as Check,
	DotsSixVerticalIcon as GripVertical,
	GearSixIcon as Settings2,
} from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState } from "react";
import { Button } from "~/button";
import {
	Sortable,
	SortableDragHandle,
	SortableItem,
} from "~/data-table-filters/components/custom/sortable";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import { boxRadiusClassName } from "~/data-table-filters/lib/style";
import { cn } from "~/lib/utils";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/shadcn/popover";

export function DataTableViewOptions() {
	const { table, enableColumnOrdering } = useDataTable();
	const [open, setOpen] = useState(false);
	const [drag, setDrag] = useState(false);
	const [search, setSearch] = useState("");

	const columnOrder = table.state.columnOrder;

	const sortedColumns = useMemo(
		() =>
			table.getAllColumns().sort((a, b) => {
				return columnOrder.indexOf(a.id) - columnOrder.indexOf(b.id);
			}),
		[columnOrder, table],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="outline"
						size="icon"
						role="combobox"
						aria-expanded={open}
						className="shadow-none"
					/>
				}
			>
				<Settings2 className="h-4 w-4" />
				<span className="sr-only">View</span>
			</PopoverTrigger>
			<PopoverContent side="bottom" align="end" className="w-[200px] p-0">
				<Command>
					<CommandInput
						value={search}
						onValueChange={setSearch}
						placeholder="Search options..."
					/>
					<CommandList>
						<CommandEmpty>No option found.</CommandEmpty>
						<CommandGroup>
							<Sortable
								value={sortedColumns.map((c) => ({ id: c.id }))}
								onValueChange={(items) =>
									table.setColumnOrder(items.map((c) => c.id))
								}
								overlay={
									<div
										className={cn("h-8 w-full bg-muted/60", boxRadiusClassName)}
									/>
								}
								onDragStart={() => setDrag(true)}
								onDragEnd={() => setDrag(false)}
								onDragCancel={() => setDrag(false)}
							>
								{sortedColumns
									// `getCanHide()` is the single source of truth: columns that
									// must always render (select) declare `enableHiding: false`
									// instead of being special-cased here.
									.filter((column) => column.getCanHide())
									.map((column) => (
										<SortableItem key={column.id} value={column.id} asChild>
											<CommandItem
												value={column.id}
												onSelect={() =>
													column.toggleVisibility(!column.getIsVisible())
												}
												className={"capitalize"}
												disabled={drag}
											>
												<div
													className={cn(
														"flex h-4 w-4 items-center justify-center rounded-sm border border-input",
														column.getIsVisible()
															? "bg-primary text-primary-foreground"
															: "opacity-50 [&_svg]:invisible",
													)}
												>
													<Check className={cn("size-3 text-background")} />
												</div>
												<span>{column.columnDef.meta?.label || column.id}</span>
												<span data-slot="command-shortcut" className="hidden" />
												{enableColumnOrdering && !search ? (
													<SortableDragHandle
														variant="ghost"
														size="icon"
														className="ml-auto size-5 text-muted-foreground hover:text-foreground focus:bg-muted focus:text-foreground"
													>
														<GripVertical
															className="size-4"
															aria-hidden="true"
														/>
													</SortableDragHandle>
												) : null}
											</CommandItem>
										</SortableItem>
									))}
							</Sortable>
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
