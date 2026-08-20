"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Square Web Payments SDK type declarations ───────────────────────

interface SquarePayments {
	card(): Promise<SquareCard>;
}

interface SquareCard {
	attach(container: string | HTMLElement): Promise<void>;
	tokenize(): Promise<SquareTokenResult>;
	destroy(): Promise<void>;
}

interface SquareTokenResult {
	status: "OK" | "ERROR";
	token?: string;
	errors?: Array<{ message: string }>;
}

declare global {
	interface Window {
		Square?: {
			payments(
				applicationId: string,
				locationId: string,
			): Promise<SquarePayments>;
		};
	}
}

const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PRODUCTION = "https://web.squarecdn.com/v1/square.js";

// ─── Script loader ───────────────────────────────────────────────────

let scriptLoadPromise: Promise<void> | null = null;

function loadSquareScript(sandbox: boolean): Promise<void> {
	if (scriptLoadPromise) return scriptLoadPromise;
	if (window.Square) return Promise.resolve();

	scriptLoadPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = sandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			scriptLoadPromise = null;
			reject(new Error("Failed to load Square payment SDK"));
		};
		document.head.appendChild(script);
	});

	return scriptLoadPromise;
}

// ─── Check if Square is configured ───────────────────────────────────

export function isSquareConfigured(): boolean {
	return (
		!!process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID &&
		!!process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID
	);
}

// ─── Main component ──────────────────────────────────────────────────

export interface SquarePaymentFormProps {
	onNonce: (nonce: string) => void;
	onError: (message: string) => void;
	isProcessing: boolean;
	setProcessing: (v: boolean) => void;
	onBack: () => void;
}

export function SquarePaymentForm({
	onNonce,
	onError,
	isProcessing,
	setProcessing,
	onBack,
}: SquarePaymentFormProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const cardRef = useRef<SquareCard | null>(null);
	const [ready, setReady] = useState(false);
	const [loading, setLoading] = useState(true);

	const applicationId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? "";
	const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";
	const isSandbox = applicationId.startsWith("sandbox-");

	useEffect(() => {
		let cancelled = false;

		async function init() {
			if (!applicationId || !locationId) {
				onError("Square payment is not configured. Contact the store owner.");
				setLoading(false);
				return;
			}

			try {
				await loadSquareScript(isSandbox);
				if (cancelled || !containerRef.current || !window.Square) return;

				const payments = await window.Square.payments(
					applicationId,
					locationId,
				);
				const card = await payments.card();

				if (cancelled) {
					void card.destroy();
					return;
				}

				await card.attach(containerRef.current);
				cardRef.current = card;
				setReady(true);
			} catch (err) {
				if (!cancelled) {
					onError(
						err instanceof Error
							? err.message
							: "Failed to initialize payment form",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void init();

		return () => {
			cancelled = true;
			if (cardRef.current) {
				void cardRef.current.destroy();
				cardRef.current = null;
			}
		};
	}, [applicationId, locationId, isSandbox, onError]);

	const handleSubmit = useCallback(async () => {
		if (!cardRef.current) {
			onError("Payment form is not ready. Please wait.");
			return;
		}

		setProcessing(true);

		try {
			const result = await cardRef.current.tokenize();
			if (result.status === "OK" && result.token) {
				onNonce(result.token);
			} else {
				const message =
					result.errors?.[0]?.message ??
					"Failed to process card. Please try again.";
				onError(message);
				setProcessing(false);
			}
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to process payment. Please try again.";
			onError(message);
			setProcessing(false);
		}
	}, [onNonce, onError, setProcessing]);

	return (
		<div className="mb-6 rounded-lg border border-border/40 p-5">
			<div className="mb-4 flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-foreground"
					aria-hidden="true"
				>
					<rect width="20" height="14" x="2" y="5" rx="2" />
					<line x1="2" x2="22" y1="10" y2="10" />
				</svg>
				<span className="font-medium text-foreground text-sm">
					Credit or debit card
				</span>
			</div>

			{loading && (
				<div className="flex items-center justify-center py-6">
					<div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
				</div>
			)}

			{!applicationId || !locationId ? (
				<div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
					<p className="text-amber-700 text-sm dark:text-amber-400">
						Square is not configured. Contact the store owner.
					</p>
				</div>
			) : (
				<div ref={containerRef} data-testid="square-card-container" />
			)}

			<div className="mt-4 flex items-center gap-1.5">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-muted-foreground"
					aria-hidden="true"
				>
					<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
					<path d="M7 11V7a5 5 0 0 1 10 0v4" />
				</svg>
				<p className="text-muted-foreground text-xs">
					Payment is processed securely via Square. Your card details are never
					stored on our servers.
				</p>
			</div>

			<button
				type="button"
				onClick={handleSubmit}
				disabled={!ready || isProcessing}
				className="mt-4 w-full rounded-lg bg-foreground px-5 py-3 text-center font-semibold text-background text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
			>
				{isProcessing ? (
					<span className="flex items-center justify-center gap-2">
						<svg
							className="size-4 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
						Processing payment...
					</span>
				) : (
					"Confirm & review order"
				)}
			</button>

			<button
				type="button"
				onClick={onBack}
				disabled={isProcessing}
				className="mt-3 w-full rounded-lg border border-border/60 px-5 py-2.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
			>
				Back to shipping
			</button>
		</div>
	);
}
