"use client";

import { useState } from "react";
import { useTicketsApi } from "./_hooks";
import { extractError } from "./_utils";
import TicketFormTemplate from "./ticket-form.mdx";

interface TicketCategory {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	position: number;
	isActive: boolean;
}

interface CategoriesResponse {
	categories: TicketCategory[];
}

export function TicketForm({
	onSuccess,
}: {
	onSuccess?: (() => void) | undefined;
}) {
	const api = useTicketsApi();

	const { data: categoriesData, isLoading: categoriesLoading } =
		api.listCategories.useQuery({}) as {
			data: CategoriesResponse | undefined;
			isLoading: boolean;
		};

	const categories = categoriesData?.categories ?? [];

	const [customerName, setCustomerName] = useState("");
	const [customerEmail, setCustomerEmail] = useState("");
	const [categoryId, setCategoryId] = useState("");
	const [subject, setSubject] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState("normal");
	const [orderId, setOrderId] = useState("");

	const submitMutation = api.submitTicket.useMutation({
		onSuccess: () => {
			if (onSuccess) onSuccess();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		submitMutation.mutate({
			customerName,
			customerEmail,
			categoryId: categoryId || undefined,
			subject,
			description,
			priority,
			orderId: orderId.trim() || undefined,
		});
	};

	const error = submitMutation.isError
		? extractError(submitMutation.error, "Failed to submit ticket.")
		: "";

	return (
		<TicketFormTemplate
			categories={categories}
			categoriesLoading={categoriesLoading}
			success={submitMutation.isSuccess}
			customerName={customerName}
			onCustomerNameChange={setCustomerName}
			customerEmail={customerEmail}
			onCustomerEmailChange={setCustomerEmail}
			categoryId={categoryId}
			onCategoryIdChange={setCategoryId}
			subject={subject}
			onSubjectChange={setSubject}
			description={description}
			onDescriptionChange={setDescription}
			priority={priority}
			onPriorityChange={setPriority}
			orderId={orderId}
			onOrderIdChange={setOrderId}
			onSubmit={handleSubmit}
			error={error}
			isLoading={submitMutation.isPending}
		/>
	);
}
