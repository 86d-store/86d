import { beforeEach, describe, expect, it } from "vitest";
import { uiState } from "../ui-state";

beforeEach(() => {
	uiState.isSearchOpen = false;
	uiState.clearToasts();
});

// ── Search command palette ──────────────────────────────────────────

describe("search state", () => {
	it("starts closed by default", () => {
		expect(uiState.isSearchOpen).toBe(false);
	});

	it("openSearch sets isSearchOpen to true", () => {
		uiState.openSearch();
		expect(uiState.isSearchOpen).toBe(true);
	});

	it("closeSearch sets isSearchOpen to false", () => {
		uiState.openSearch();
		uiState.closeSearch();
		expect(uiState.isSearchOpen).toBe(false);
	});

	it("toggleSearch opens when closed", () => {
		uiState.toggleSearch();
		expect(uiState.isSearchOpen).toBe(true);
	});

	it("toggleSearch closes when open", () => {
		uiState.openSearch();
		uiState.toggleSearch();
		expect(uiState.isSearchOpen).toBe(false);
	});

	it("toggleSearch can be called multiple times", () => {
		uiState.toggleSearch();
		uiState.toggleSearch();
		uiState.toggleSearch();
		expect(uiState.isSearchOpen).toBe(true);
	});
});

// ── Toast notifications ─────────────────────────────────────────────

describe("toast state", () => {
	it("starts with an empty toasts array", () => {
		expect(uiState.toasts).toHaveLength(0);
	});

	it("addToast pushes a toast to the queue", () => {
		uiState.addToast("Hello");
		expect(uiState.toasts).toHaveLength(1);
	});

	it("addToast returns a unique string id", () => {
		const id1 = uiState.addToast("First");
		const id2 = uiState.addToast("Second");
		expect(typeof id1).toBe("string");
		expect(id1).not.toBe(id2);
	});

	it("addToast id starts with toast-", () => {
		const id = uiState.addToast("Msg");
		expect(id.startsWith("toast-")).toBe(true);
	});

	it("addToast uses default variant default and duration 4000", () => {
		uiState.addToast("Info");
		const toast = uiState.toasts[0];
		expect(toast?.variant).toBe("default");
		expect(toast?.duration).toBe(4000);
	});

	it("addToast accepts explicit variant", () => {
		uiState.addToast("Oops", "error");
		expect(uiState.toasts[0]?.variant).toBe("error");
	});

	it("addToast accepts explicit duration", () => {
		uiState.addToast("Quick", "success", 1000);
		expect(uiState.toasts[0]?.duration).toBe(1000);
	});

	it("multiple toasts are queued in order", () => {
		uiState.addToast("First");
		uiState.addToast("Second");
		uiState.addToast("Third");
		expect(uiState.toasts).toHaveLength(3);
		expect(uiState.toasts[0]?.message).toBe("First");
		expect(uiState.toasts[2]?.message).toBe("Third");
	});

	it("removeToast removes the matching toast by id", () => {
		const id = uiState.addToast("Removable");
		uiState.removeToast(id);
		expect(uiState.toasts).toHaveLength(0);
	});

	it("removeToast leaves other toasts intact", () => {
		const id1 = uiState.addToast("Keep");
		const id2 = uiState.addToast("Remove");
		uiState.removeToast(id2);
		expect(uiState.toasts).toHaveLength(1);
		expect(uiState.toasts[0]?.id).toBe(id1);
	});

	it("removeToast is a no-op for unknown id", () => {
		uiState.addToast("Existing");
		uiState.removeToast("toast-nonexistent");
		expect(uiState.toasts).toHaveLength(1);
	});

	it("clearToasts empties the queue", () => {
		uiState.addToast("A");
		uiState.addToast("B");
		uiState.clearToasts();
		expect(uiState.toasts).toHaveLength(0);
	});

	it("clearToasts is a no-op on an already-empty queue", () => {
		expect(() => uiState.clearToasts()).not.toThrow();
		expect(uiState.toasts).toHaveLength(0);
	});
});
