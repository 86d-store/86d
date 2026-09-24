"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import type {
	DndContextProps,
	DraggableSyntheticListeners,
	DropAnimation,
	UniqueIdentifier,
} from "@dnd-kit/core";
import {
	closestCenter,
	DndContext,
	DragOverlay,
	defaultDropAnimationSideEffects,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	restrictToHorizontalAxis,
	restrictToParentElement,
	restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	type SortableContextProps,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	type ComponentProps,
	type CSSProperties,
	cloneElement,
	createContext,
	type HTMLAttributes,
	isValidElement,
	type ReactNode,
	type Ref,
	useContext,
	useMemo,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "~/button";
import { composeRefs } from "~/data-table-filters/lib/compose-refs";
import { cn } from "~/lib/utils";

/** Base UI-friendly slot: merge props onto the single child element. */
function Slot({
	children,
	ref,
	...props
}: HTMLAttributes<HTMLElement> & {
	children?: ReactNode;
	ref?: Ref<HTMLElement>;
}) {
	if (!isValidElement(children)) {
		return (
			<div ref={ref as Ref<HTMLDivElement>} {...props}>
				{children}
			</div>
		);
	}
	const child = children as React.ReactElement<Record<string, unknown>>;
	return cloneElement(
		child,
		mergeProps(child.props, {
			...props,
			ref: composeRefs(
				ref,
				(child as { props?: { ref?: Ref<HTMLElement> } }).props?.ref,
			),
		}),
	);
}

type SlotProps = HTMLAttributes<HTMLElement> & {
	children?: ReactNode;
};

const orientationConfig = {
	vertical: {
		modifiers: [restrictToVerticalAxis, restrictToParentElement],
		strategy: verticalListSortingStrategy,
	},
	horizontal: {
		modifiers: [restrictToHorizontalAxis, restrictToParentElement],
		strategy: horizontalListSortingStrategy,
	},
	mixed: {
		modifiers: [restrictToParentElement],
		strategy: undefined,
	},
};

interface SortableProps<TData extends { id: UniqueIdentifier }>
	extends Omit<
		DndContextProps,
		"collisionDetection" | "modifiers" | "children"
	> {
	/**
	 * An array of data items that the sortable component will render.
	 * @example
	 * value={[
	 *   { id: 1, name: 'Item 1' },
	 *   { id: 2, name: 'Item 2' },
	 * ]}
	 */
	value: TData[];

	/**
	 * An optional callback function that is called when the order of the data items changes.
	 * It receives the new array of items as its argument.
	 * @example
	 * onValueChange={(items) => console.log(items)}
	 */
	onValueChange?: ((items: TData[]) => void) | undefined;

	/**
	 * An optional callback function that is called when an item is moved.
	 * It receives an event object with `activeIndex` and `overIndex` properties, representing the original and new positions of the moved item.
	 * This will override the default behavior of updating the order of the data items.
	 * @type (event: { activeIndex: number; overIndex: number }) => void
	 * @example
	 * onMove={(event) => console.log(`Item moved from index ${event.activeIndex} to index ${event.overIndex}`)}
	 */
	onMove?:
		| ((event: { activeIndex: number; overIndex: number }) => void)
		| undefined;

	/**
	 * A collision detection strategy that will be used to determine the closest sortable item.
	 * @default closestCenter
	 * @type DndContextProps["collisionDetection"]
	 */
	collisionDetection?: DndContextProps["collisionDetection"] | undefined;

	/**
	 * An array of modifiers that will be used to modify the behavior of the sortable component.
	 * @default
	 * [restrictToVerticalAxis, restrictToParentElement]
	 * @type Modifier[]
	 */
	modifiers?: DndContextProps["modifiers"] | undefined;

	/**
	 * A sorting strategy that will be used to determine the new order of the data items.
	 * @default verticalListSortingStrategy
	 * @type SortableContextProps["strategy"]
	 */
	strategy?: SortableContextProps["strategy"] | undefined;

	/**
	 * Specifies the axis for the drag-and-drop operation. It can be "vertical", "horizontal", or "both".
	 * @default "vertical"
	 * @type "vertical" | "horizontal" | "mixed"
	 */
	orientation?: "vertical" | "horizontal" | "mixed" | undefined;

	/**
	 * An optional React node that is rendered on top of the sortable component.
	 * It can be used to display additional information or controls.
	 * @default null
	 * @type ReactNode | null
	 * @example
	 * overlay={<Skeleton className="w-full h-8" />}
	 */
	overlay?: ReactNode | null | undefined;

	children?: ReactNode | undefined;
}

function Sortable<TData extends { id: UniqueIdentifier }>({
	value,
	onValueChange,
	onDragStart,
	onDragEnd,
	onDragCancel,
	collisionDetection = closestCenter,
	modifiers,
	strategy,
	onMove,
	orientation = "vertical",
	overlay,
	children,
	...props
}: SortableProps<TData>) {
	const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
	const sensors = useSensors(
		useSensor(MouseSensor),
		useSensor(TouchSensor),
		useSensor(KeyboardSensor),
	);

	const config = orientationConfig[orientation];

	return (
		<DndContext
			modifiers={modifiers ?? config.modifiers}
			sensors={sensors}
			onDragStart={(event) => {
				setActiveId(event.active.id);
				onDragStart?.(event);
			}}
			onDragEnd={(event) => {
				const { active, over } = event;
				if (over && active.id !== over?.id) {
					const activeIndex = value.findIndex((item) => item.id === active.id);
					const overIndex = value.findIndex((item) => item.id === over.id);

					if (onMove) {
						onMove({ activeIndex, overIndex });
					} else {
						onValueChange?.(arrayMove(value, activeIndex, overIndex));
					}
				}
				setActiveId(null);
				onDragEnd?.(event);
			}}
			onDragCancel={(event) => {
				setActiveId(null);
				onDragCancel?.(event);
			}}
			collisionDetection={collisionDetection}
			{...props}
		>
			<SortableContext
				items={value}
				strategy={strategy ?? config.strategy ?? verticalListSortingStrategy}
			>
				{children}
			</SortableContext>
			{overlay
				? // https://docs.dndkit.com/api-documentation/draggable/drag-overlay#portals
					createPortal(
						<SortableOverlay activeId={activeId}>{overlay}</SortableOverlay>,
						document.body,
					)
				: null}
		</DndContext>
	);
}

const dropAnimationOpts: DropAnimation = {
	sideEffects: defaultDropAnimationSideEffects({
		styles: {
			active: {
				opacity: "0.4",
			},
		},
	}),
};

interface SortableOverlayProps
	extends React.ComponentPropsWithRef<typeof DragOverlay> {
	activeId?: UniqueIdentifier | null;
}

function SortableOverlay({
	activeId,
	dropAnimation = dropAnimationOpts,
	children,
	...props
}: SortableOverlayProps) {
	return (
		<DragOverlay dropAnimation={dropAnimation} {...props}>
			{activeId ? (
				// REMINDER: `asChild` is spread, not written as an attribute. When the
				// shadcn CLI installs into a Base UI project it rewrites a literal
				// `asChild` into `render={<child />}` — and where the child is an
				// expression rather than an element, as here, it drops the prop
				// instead, which would silently turn the overlay into a wrapper div.
				<SortableItem
					value={activeId}
					className="cursor-grabbing"
					{...{ asChild: true }}
				>
					{children}
				</SortableItem>
			) : null}
		</DragOverlay>
	);
}

interface SortableItemContextProps {
	attributes: HTMLAttributes<HTMLElement>;
	listeners: DraggableSyntheticListeners | undefined;
	isDragging?: boolean;
}

const SortableItemContext = createContext<SortableItemContextProps>({
	attributes: {},
	listeners: undefined,
	isDragging: false,
});

function useSortableItem() {
	const context = useContext(SortableItemContext);

	if (!context) {
		throw new Error("useSortableItem must be used within a SortableItem");
	}

	return context;
}

interface SortableItemProps extends SlotProps {
	/**
	 * The unique identifier of the item.
	 * @example "item-1"
	 * @type UniqueIdentifier
	 */
	value: UniqueIdentifier;

	/**
	 * Specifies whether the item should act as a trigger for the drag-and-drop action.
	 * @default false
	 * @type boolean | undefined
	 */
	asTrigger?: boolean;

	/**
	 * Merges the item's props into its immediate child.
	 * @default false
	 * @type boolean | undefined
	 */
	asChild?: boolean;

	/**
	 * The element to render as, with the item's props merged into it — Base UI's
	 * spelling of `asChild`. The shadcn CLI rewrites `asChild` into `render` when
	 * it installs into a Base UI project, so this component has to understand
	 * both; it is built on Radix either way, since it ships with the block.
	 * @type React.ReactElement | undefined
	 */
	render?: React.ReactElement;
}

function SortableItem({
	value,
	asTrigger,
	asChild,
	render,
	className,
	children,
	ref,
	...props
}: SortableItemProps & { ref?: Ref<HTMLDivElement> }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: value });

	const context = useMemo<SortableItemContextProps>(
		() => ({
			attributes,
			listeners,
			isDragging,
		}),
		[attributes, listeners, isDragging],
	);
	const style: CSSProperties = {
		opacity: isDragging ? 0.5 : 1,
		transform: CSS.Translate.toString(transform),
		transition,
	};

	const Comp = asChild || render ? Slot : "div";

	// Base UI nests the children inside the `render` element; Radix's `asChild`
	// expects them to already be there.
	const content = render
		? children === undefined
			? render
			: cloneElement(render, undefined, children)
		: children;

	return (
		<SortableItemContext.Provider value={context}>
			<Comp
				data-state={isDragging ? "dragging" : undefined}
				className={cn(
					"data-[state=dragging]:cursor-grabbing",
					{ "cursor-grab": !isDragging && asTrigger },
					className,
				)}
				ref={composeRefs(ref, setNodeRef as Ref<HTMLDivElement>)}
				style={style}
				{...(asTrigger ? attributes : {})}
				{...(asTrigger ? listeners : {})}
				{...props}
			>
				{content}
			</Comp>
		</SortableItemContext.Provider>
	);
}

interface SortableDragHandleProps extends ComponentProps<typeof Button> {
	withHandle?: boolean;
}

function SortableDragHandle({
	className,
	ref,
	...props
}: SortableDragHandleProps) {
	const { attributes, listeners, isDragging } = useSortableItem();

	return (
		<Button
			ref={composeRefs(ref)}
			data-state={isDragging ? "dragging" : undefined}
			className={cn(
				"cursor-grab data-[state=dragging]:cursor-grabbing",
				className,
			)}
			{...attributes}
			{...listeners}
			{...props}
		/>
	);
}

export { Sortable, SortableDragHandle, SortableItem, SortableOverlay };
