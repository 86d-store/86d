import { makeAutoObservable } from "@86d-app/core/state";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
	id: string;
	message: string;
	variant: ToastVariant;
	duration: number;
}

let toastCounter = 0;

/**
 * Shared UI state — toast notifications and search command visibility.
 * Available to any component via the root store.
 */
export const uiState = makeAutoObservable({
	/** Whether the search command palette is open */
	isSearchOpen: false,
	/** Active toast queue (FIFO) */
	toasts: [] as Toast[],

	openSearch() {
		this.isSearchOpen = true;
	},

	closeSearch() {
		this.isSearchOpen = false;
	},

	toggleSearch() {
		this.isSearchOpen = !this.isSearchOpen;
	},

	/**
	 * Show a toast notification. Returns the toast id.
	 */
	addToast(
		message: string,
		variant: ToastVariant = "default",
		duration = 4000,
	): string {
		const id = `toast-${++toastCounter}`;
		this.toasts.push({ id, message, variant, duration });
		return id;
	},

	removeToast(id: string) {
		const idx = this.toasts.findIndex((t) => t.id === id);
		if (idx !== -1) this.toasts.splice(idx, 1);
	},

	clearToasts() {
		this.toasts.length = 0;
	},
});

export type UiState = typeof uiState;
