"use client";

import { useState } from "react";
import { usePaymentsStoreApi } from "./_hooks";
import SavedPaymentMethodsTemplate from "./saved-payment-methods.mdx";

interface PaymentMethod {
	id: string;
	type: string;
	last4?: string | undefined;
	brand?: string | undefined;
	expiryMonth?: number | undefined;
	expiryYear?: number | undefined;
	isDefault: boolean;
}

export function SavedPaymentMethods({
	isAuthenticated,
}: {
	isAuthenticated?: boolean | undefined;
}) {
	const api = usePaymentsStoreApi();
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState("");

	const { data, isLoading, refetch } = api.listMethods.useQuery({}) as {
		data:
			| { methods: PaymentMethod[] }
			| { error: string; status: number }
			| undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const successData = data as { methods: PaymentMethod[] } | undefined;
	const isUnauthenticated =
		!isLoading && (data as { status?: number } | undefined)?.status === 401;

	const deleteMutation = api.deleteMethod.useMutation({
		onMutate: (variables) => {
			setDeletingId((variables as { params: { id: string } }).params.id);
			setDeleteError("");
		},
		onSuccess: () => {
			setDeletingId(null);
			void refetch();
		},
		onError: () => {
			setDeletingId(null);
			setDeleteError("Failed to remove payment method.");
		},
	});

	const handleDelete = (id: string) => {
		deleteMutation.mutate({ params: { id } });
	};

	const methods = successData?.methods ?? [];

	return (
		<SavedPaymentMethodsTemplate
			isLoading={isLoading}
			isAuthenticated={isAuthenticated ?? !isUnauthenticated}
			methods={methods}
			deletingId={deletingId}
			deleteError={deleteError}
			onDelete={handleDelete}
		/>
	);
}
