"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import BookingListTemplate from "./booking-list.mdx";

const PAGE_SIZE = 25;

interface BookingItem {
	id: string;
	scheduleId: string;
	orderId: string;
	customerId: string;
	deliveryDate: string;
	status: string;
	instructions?: string | null;
	createdAt: string;
}

function extractError(err: unknown, fallback = "Action failed"): string {
	const e = err as { message?: string } | null;
	return typeof e?.message === "string" ? e.message : fallback;
}

function useBookingAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("delivery-slots").admin[
			"/admin/delivery-slots/bookings"
		],
		cancel:
			client.module("delivery-slots").admin[
				"/admin/delivery-slots/bookings/:id/cancel"
			],
	};
}

export function BookingList() {
	const api = useBookingAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");
	const [dateFilter, setDateFilter] = useState("");
	const [cancelError, setCancelError] = useState("");

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (statusFilter) queryInput.status = statusFilter;
	if (dateFilter) queryInput.deliveryDate = dateFilter;

	const {
		data,
		isLoading: loading,
		refetch,
	} = api.list.useQuery(queryInput) as {
		data: { bookings: BookingItem[] } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const cancelMutation = api.cancel.useMutation({
		onSuccess: () => {
			setCancelError("");
			void refetch();
		},
		onError: (err: Error) => setCancelError(extractError(err)),
	});

	const bookings = data?.bookings ?? [];
	const hasMore = bookings.length === PAGE_SIZE;

	return (
		<BookingListTemplate
			bookings={bookings}
			loading={loading}
			skip={skip}
			pageSize={PAGE_SIZE}
			hasMore={hasMore}
			onNext={() => setSkip((s) => s + PAGE_SIZE)}
			onPrev={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
			statusFilter={statusFilter}
			onStatusFilterChange={setStatusFilter}
			dateFilter={dateFilter}
			onDateFilterChange={setDateFilter}
			cancelError={cancelError}
			isCancelling={cancelMutation.isPending}
			cancellingId={
				cancelMutation.isPending
					? ((
							cancelMutation.variables as { params: { id: string } } | undefined
						)?.params.id ?? null)
					: null
			}
			onCancel={(id: string) => cancelMutation.mutate({ params: { id } })}
		/>
	);
}
