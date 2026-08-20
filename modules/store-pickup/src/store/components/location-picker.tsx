"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import LocationPickerTemplate from "./location-picker.mdx";

interface LocationItem {
	id: string;
	name: string;
	address: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string;
	preparationMinutes: number;
}

interface WindowItem {
	window: {
		id: string;
		startTime: string;
		endTime: string;
		capacity: number;
	};
	date: string;
	booked: number;
	remaining: number;
	available: boolean;
}

function useStorePickupStoreApi() {
	const client = useModuleClient();
	return {
		locations: client.module("store-pickup").store["/store-pickup/locations"],
		windows:
			client.module("store-pickup").store[
				"/store-pickup/locations/:locationId/windows"
			],
	};
}

export function LocationPicker() {
	const api = useStorePickupStoreApi();
	const today = new Date().toISOString().slice(0, 10);
	const [selectedLocation, setSelectedLocation] = useState("");
	const [selectedDate, setSelectedDate] = useState(today);

	const { data: locData, isLoading: loadingLocations } = api.locations.useQuery(
		{},
	) as {
		data: { locations: LocationItem[] } | undefined;
		isLoading: boolean;
	};

	const { data: winData, isLoading: loadingWindows } = api.windows.useQuery(
		selectedLocation
			? { locationId: selectedLocation, date: selectedDate }
			: null,
	) as {
		data: { windows: WindowItem[] } | undefined;
		isLoading: boolean;
	};

	const locations = locData?.locations ?? [];
	const windows = winData?.windows ?? [];

	return (
		<LocationPickerTemplate
			locations={locations}
			windows={windows}
			loadingLocations={loadingLocations}
			loadingWindows={loadingWindows}
			selectedLocation={selectedLocation}
			selectedDate={selectedDate}
			onLocationChange={setSelectedLocation}
			onDateChange={setSelectedDate}
		/>
	);
}
