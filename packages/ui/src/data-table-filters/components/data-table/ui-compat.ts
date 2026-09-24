/**
 * Base UI prop spellings for overlay primitives used by the filter stack.
 *
 * Upstream spreads both Radix and Base UI names; this workspace is Base UI only.
 */

/** Base UI TooltipProvider delay (ms). */
export const TOOLTIP_DELAY = { delay: 100 };

/** Base UI tooltip root: disable hoverable popup. */
export const TOOLTIP_NOT_HOVERABLE = {
	disableHoverablePopup: true,
};

/**
 * Hover-card delay props are Radix-only; Base UI preview-card uses defaults.
 * Kept as an empty object so call sites can still spread it.
 */
export const HOVER_CARD_DELAY = {};
