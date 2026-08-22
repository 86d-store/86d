"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import SlotPickerTemplate from "./slot-picker.mdx";

interface SlotItem {
	schedule: {
		id: string;
		name: string;
		startTime: string;
		endTime: string;
		surchargeInCents: number;
	};
	date: string;
	booked: number;
	remaining: number;
	available: boolean;
}

function useDeliverySlotsStoreApi() {
	const client = useModuleClient();
	return {
		available:
			client.module("delivery-slots").store["/delivery-slots/available"],
		book: client.module("delivery-slots").store["/delivery-slots/book"],
	};
}

function getOrderIdFromUrl(): string {
	if (typeof window === "undefined") return "";
	return new URLSearchParams(window.location.search).get("orderId") ?? "";
}

export function SlotPicker() {
	const api = useDeliverySlotsStoreApi();
	const today = new Date().toISOString().slice(0, 10);
	const [selectedDate, setSelectedDate] = useState(today);
	const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
	const [instructions, setInstructions] = useState("");
	const [bookError, setBookError] = useState("");
	const [booked, setBooked] = useState(false);

	const orderId = getOrderIdFromUrl();

	const {
		data,
		isLoading: loading,
		refetch,
	} = api.available.useQuery({
		date: selectedDate,
	}) as {
		data: { slots: SlotItem[] } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const bookMutation = api.book.useMutation({
		onSuccess: () => {
			setBooked(true);
			setBookError("");
			void refetch();
		},
		onError: (err: Error) => {
			setBookError(err.message);
		},
	});

	const slots = data?.slots ?? [];
	const selectedSlot = slots.find((s) => s.schedule.id === selectedSlotId);

	const handleBook = () => {
		if (!selectedSlotId || !orderId) return;
		setBookError("");
		bookMutation.mutate({
			scheduleId: selectedSlotId,
			deliveryDate: selectedDate,
			orderId,
			...(instructions.trim() ? { instructions: instructions.trim() } : {}),
		});
	};

	return (
		<SlotPickerTemplate
			slots={slots}
			loading={loading}
			selectedDate={selectedDate}
			onDateChange={(d: string) => {
				setSelectedDate(d);
				setSelectedSlotId(null);
			}}
			selectedSlotId={selectedSlotId}
			onSelectSlot={setSelectedSlotId}
			selectedSlot={selectedSlot ?? null}
			instructions={instructions}
			onInstructionsChange={setInstructions}
			onBook={handleBook}
			isBooking={bookMutation.isPending}
			bookError={bookError}
			booked={booked}
			hasOrderId={!!orderId}
		/>
	);
}
