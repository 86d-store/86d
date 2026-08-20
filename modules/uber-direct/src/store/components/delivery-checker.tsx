"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useState } from "react";
import DeliveryCheckerTemplate from "./delivery-checker.mdx";

interface AvailabilityResult {
	available: boolean;
	deliveryFee?: number | undefined;
	estimatedMinutes?: number | undefined;
}

function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

export interface DeliveryCheckerProps {
	currency?: string;
}

export function DeliveryChecker({ currency = "USD" }: DeliveryCheckerProps) {
	const client = useModuleClient();
	const api = client.module("uber-direct").store["/uber-direct/availability"];

	const [lat, setLat] = useState<number | null>(null);
	const [lng, setLng] = useState<number | null>(null);
	const [locating, setLocating] = useState(false);
	const [locationError, setLocationError] = useState<string | null>(null);

	const query = api.useQuery(
		lat !== null && lng !== null ? { lat, lng } : { lat: 0, lng: 0 },
		{ enabled: lat !== null && lng !== null },
	) as {
		data: (AvailabilityResult & { error?: string }) | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	const handleLocate = useCallback(() => {
		if (!navigator.geolocation) {
			setLocationError("Geolocation is not supported by your browser.");
			return;
		}
		setLocating(true);
		setLocationError(null);
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setLat(position.coords.latitude);
				setLng(position.coords.longitude);
				setLocating(false);
			},
			() => {
				setLocationError(
					"Unable to get your location. Please allow location access and try again.",
				);
				setLocating(false);
			},
		);
	}, []);

	const isChecking =
		locating || (lat !== null && lng !== null && query.isLoading);
	const result =
		query.data && !query.data.error ? (query.data as AvailabilityResult) : null;
	const error =
		locationError ?? query.error?.message ?? query.data?.error ?? null;

	return (
		<DeliveryCheckerTemplate
			onLocate={handleLocate}
			isChecking={isChecking}
			hasResult={lat !== null && lng !== null}
			result={result}
			error={error}
			currency={currency}
			formatCurrency={formatCurrency}
		/>
	);
}
