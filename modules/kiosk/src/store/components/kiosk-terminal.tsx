"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useKioskStoreApi } from "./_hooks";
import KioskTerminalTemplate from "./kiosk-terminal.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface KioskItem {
	id: string;
	name: string;
	price: number;
	quantity: number;
}

interface KioskSession {
	id: string;
	stationId: string;
	status: "active" | "completed" | "abandoned" | "timed-out";
	items: KioskItem[];
	subtotal: number;
	tax: number;
	tip: number;
	total: number;
	paymentStatus: "pending" | "paid" | "failed";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

function extractError(err: unknown, fallback = "Something went wrong"): string {
	const e = err as { body?: { error?: string }; message?: string } | null;
	if (typeof e?.body?.error === "string") return e.body.error;
	if (typeof e?.message === "string") return e.message;
	return fallback;
}

// ── KioskTerminal ────────────────────────────────────────────────────────────

export interface KioskTerminalProps {
	/** Station ID this terminal is registered as */
	stationId?: string | undefined;
	/** ISO 4217 currency code (default: "USD") */
	currency?: string;
	/** Idle timeout in seconds before auto-reset (default: 120) */
	idleTimeout?: number;
	params?: Record<string, string> | undefined;
}

export function KioskTerminal(props: KioskTerminalProps) {
	const stationId = props.stationId ?? props.params?.stationId ?? "";
	const currency = props.currency ?? "USD";
	const idleTimeout = props.idleTimeout ?? 120;
	const api = useKioskStoreApi();

	const [session, setSession] = useState<KioskSession | null>(null);
	const [itemName, setItemName] = useState("");
	const [itemPrice, setItemPrice] = useState("");
	const [itemQty, setItemQty] = useState(1);
	const [addError, setAddError] = useState<string | null>(null);
	const [sessionError, setSessionError] = useState<string | null>(null);
	const [paymentMethod, setPaymentMethod] = useState("card");
	const [isCompleted, setIsCompleted] = useState(false);
	const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const startMutation = api.startSession.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<{
			session?: KioskSession;
		}>;
		isPending: boolean;
	};

	const addMutation = api.addItem.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<{ session?: KioskSession }>;
		isPending: boolean;
	};

	const removeMutation = api.removeItem.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string; itemId: string };
		}) => Promise<{ session?: KioskSession }>;
		isPending: boolean;
	};

	const completeMutation = api.complete.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<{ session?: KioskSession }>;
		isPending: boolean;
	};

	const heartbeatMutation = api.heartbeat.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	// Heartbeat every 30s to mark station online
	useEffect(() => {
		const id = setInterval(() => {
			heartbeatMutation
				.mutateAsync({ params: { id: stationId } })
				.catch(() => undefined);
		}, 30000);
		heartbeatMutation
			.mutateAsync({ params: { id: stationId } })
			.catch(() => undefined);
		return () => clearInterval(id);
	}, [stationId, heartbeatMutation.mutateAsync]);

	// Reset idle timer on any interaction
	const resetIdleTimer = useCallback(() => {
		clearTimeout(idleTimerRef.current ?? undefined);
		if (session && !isCompleted) {
			idleTimerRef.current = setTimeout(() => {
				setSession(null);
				setIsCompleted(false);
			}, idleTimeout * 1000);
		}
	}, [session, isCompleted, idleTimeout]);

	useEffect(() => {
		resetIdleTimer();
		return () => {
			clearTimeout(idleTimerRef.current ?? undefined);
		};
	}, [resetIdleTimer]);

	async function handleStart() {
		setSessionError(null);
		try {
			const result = await startMutation.mutateAsync({
				body: { stationId },
			});
			if (result.session) {
				setSession(result.session);
				setIsCompleted(false);
				resetIdleTimer();
			}
		} catch (err) {
			setSessionError(extractError(err, "Could not start session."));
		}
	}

	async function handleAddItem(e: React.FormEvent) {
		e.preventDefault();
		if (!session) return;
		setAddError(null);
		resetIdleTimer();

		const price = Math.round(Number.parseFloat(itemPrice) * 100);
		if (!itemName.trim()) {
			setAddError("Item name is required.");
			return;
		}
		if (Number.isNaN(price) || price < 0) {
			setAddError("Enter a valid price.");
			return;
		}

		try {
			const result = await addMutation.mutateAsync({
				params: { id: session.id },
				body: { name: itemName.trim(), price, quantity: itemQty },
			});
			if (result.session) setSession(result.session);
			setItemName("");
			setItemPrice("");
			setItemQty(1);
		} catch (err) {
			setAddError(extractError(err, "Failed to add item."));
		}
	}

	async function handleRemove(itemId: string) {
		if (!session) return;
		resetIdleTimer();
		try {
			const result = await removeMutation.mutateAsync({
				params: { id: session.id, itemId },
			});
			if (result.session) setSession(result.session);
		} catch {
			// silently ignore
		}
	}

	async function handleComplete() {
		if (!session) return;
		resetIdleTimer();
		try {
			const result = await completeMutation.mutateAsync({
				params: { id: session.id },
				body: { paymentMethod },
			});
			if (result.session) {
				setSession(result.session);
				setIsCompleted(true);
				clearTimeout(idleTimerRef.current ?? undefined);
				setTimeout(() => {
					setSession(null);
					setIsCompleted(false);
				}, 5000);
			}
		} catch {
			// silently ignore
		}
	}

	function handleReset() {
		setSession(null);
		setIsCompleted(false);
		setAddError(null);
		setSessionError(null);
	}

	const isMutating =
		startMutation.isPending ||
		addMutation.isPending ||
		removeMutation.isPending ||
		completeMutation.isPending;

	return (
		<KioskTerminalTemplate
			session={session}
			isCompleted={isCompleted}
			isMutating={isMutating}
			sessionError={sessionError}
			addError={addError}
			itemName={itemName}
			itemPrice={itemPrice}
			itemQty={itemQty}
			paymentMethod={paymentMethod}
			currency={currency}
			onStart={handleStart}
			onAddItem={handleAddItem}
			onRemove={handleRemove}
			onComplete={handleComplete}
			onReset={handleReset}
			onItemNameChange={setItemName}
			onItemPriceChange={setItemPrice}
			onItemQtyChange={setItemQty}
			onPaymentMethodChange={setPaymentMethod}
			onInteraction={resetIdleTimer}
			formatCurrency={formatCurrency}
		/>
	);
}
