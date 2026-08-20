"use client";

import { useState } from "react";
import { useAppointmentsStoreApi } from "./_hooks";
import {
	extractError,
	formatCurrency,
	formatDuration,
	formatTime,
	isoDate,
	STATUS_COLORS,
	STATUS_LABELS,
} from "./_utils";
import AppointmentBookingTemplate from "./appointment-booking.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface Service {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	duration: number;
	price: number;
	currency: string;
	status: string;
	maxCapacity: number;
}

interface Staff {
	id: string;
	name: string;
	email: string;
	bio?: string | undefined;
	status: string;
}

interface TimeSlot {
	startsAt: string;
	endsAt: string;
	staffId: string;
}

interface Appointment {
	id: string;
	serviceId: string;
	staffId: string;
	customerName: string;
	customerEmail: string;
	startsAt: string;
	endsAt: string;
	status: string;
	notes?: string | undefined;
	price: number;
	currency: string;
}

type Step = "services" | "detail" | "slots" | "form" | "confirmed";

// ── Hook: service list ───────────────────────────────────────────────────────

function useServiceList() {
	const api = useAppointmentsStoreApi();
	return api.listServices.useQuery({}) as {
		data: { services?: Service[] } | undefined;
		isLoading: boolean;
		error: Error | null;
	};
}

// ── Hook: service detail ─────────────────────────────────────────────────────

function useServiceDetail(slug: string | null) {
	const api = useAppointmentsStoreApi();
	return api.getService.useQuery(
		{ params: { slug: slug ?? "" } },
		{ enabled: Boolean(slug) },
	) as {
		data: { service?: Service; staff?: Staff[] } | undefined;
		isLoading: boolean;
		error: Error | null;
	};
}

// ── Hook: availability ───────────────────────────────────────────────────────

function useAvailability(
	serviceId: string | null,
	staffId: string | null,
	date: string | null,
) {
	const api = useAppointmentsStoreApi();
	return api.getAvailability.useQuery(
		{
			serviceId: serviceId ?? "",
			...(staffId ? { staffId } : {}),
			date: date ?? "",
		},
		{ enabled: Boolean(serviceId && date) },
	) as {
		data: { slots?: TimeSlot[] } | undefined;
		isLoading: boolean;
	};
}

// ── AppointmentBooking ───────────────────────────────────────────────────────

export function AppointmentBooking() {
	const api = useAppointmentsStoreApi();

	const [step, setStep] = useState<Step>("services");
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
	const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
	const [selectedDate, setSelectedDate] = useState<string>(isoDate(new Date()));
	const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
	const [customerName, setCustomerName] = useState("");
	const [customerEmail, setCustomerEmail] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");
	const [notes, setNotes] = useState("");
	const [formError, setFormError] = useState("");
	const [confirmedAppointment, setConfirmedAppointment] =
		useState<Appointment | null>(null);

	const servicesQuery = useServiceList();
	const detailQuery = useServiceDetail(selectedSlug);
	const availabilityQuery = useAvailability(
		detailQuery.data?.service?.id ?? null,
		selectedStaffId,
		step === "slots" ? selectedDate : null,
	);

	const bookMutation = api.book.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<{
			appointment?: Appointment;
			error?: string;
		}>;
		isPending: boolean;
	};

	const services = servicesQuery.data?.services ?? [];
	const service = detailQuery.data?.service;
	const staff = detailQuery.data?.staff ?? [];
	const slots = availabilityQuery.data?.slots ?? [];

	// ── Step navigation ──────────────────────────────────────────────────────

	function handleSelectService(slug: string) {
		setSelectedSlug(slug);
		setSelectedStaffId(null);
		setSelectedSlot(null);
		setStep("detail");
	}

	function handleSelectStaff(staffId: string) {
		setSelectedStaffId(staffId);
	}

	function handleProceedToSlots() {
		setStep("slots");
	}

	function handleSelectSlot(slot: TimeSlot) {
		setSelectedSlot(slot);
		if (!selectedStaffId) setSelectedStaffId(slot.staffId);
		setStep("form");
	}

	function handleBack() {
		if (step === "form") {
			setStep("slots");
		} else if (step === "slots") {
			setStep("detail");
		} else if (step === "detail") {
			setStep("services");
			setSelectedSlug(null);
		}
	}

	// ── Booking submission ───────────────────────────────────────────────────

	async function handleBook(e: React.FormEvent) {
		e.preventDefault();
		setFormError("");

		if (!service || !selectedSlot) return;
		if (!customerName.trim()) {
			setFormError("Name is required.");
			return;
		}
		if (!customerEmail.trim()) {
			setFormError("Email is required.");
			return;
		}

		const body: Record<string, unknown> = {
			serviceId: service.id,
			staffId: selectedStaffId ?? selectedSlot.staffId,
			customerName: customerName.trim(),
			customerEmail: customerEmail.trim(),
			startsAt: selectedSlot.startsAt,
		};
		if (customerPhone.trim()) body.customerPhone = customerPhone.trim();
		if (notes.trim()) body.notes = notes.trim();

		try {
			const result = await bookMutation.mutateAsync({ body });
			if (result.appointment) {
				setConfirmedAppointment(result.appointment);
				setStep("confirmed");
			} else {
				setFormError(result.error ?? "Booking failed. Please try again.");
			}
		} catch (err) {
			setFormError(extractError(err, "Booking failed. Please try again."));
		}
	}

	// ── Compute min date (today) ─────────────────────────────────────────────

	const todayStr = isoDate(new Date());

	return (
		<AppointmentBookingTemplate
			step={step}
			// Services step
			isLoadingServices={servicesQuery.isLoading}
			servicesError={
				servicesQuery.error
					? extractError(servicesQuery.error, "Failed to load services")
					: null
			}
			services={services}
			onSelectService={handleSelectService}
			// Detail step
			isLoadingDetail={detailQuery.isLoading}
			service={service ?? null}
			staff={staff}
			selectedStaffId={selectedStaffId}
			onSelectStaff={handleSelectStaff}
			onProceedToSlots={handleProceedToSlots}
			// Slots step
			selectedDate={selectedDate}
			todayStr={todayStr}
			onDateChange={setSelectedDate}
			isLoadingSlots={availabilityQuery.isLoading}
			slots={slots}
			onSelectSlot={handleSelectSlot}
			// Form step
			selectedSlot={selectedSlot}
			customerName={customerName}
			customerEmail={customerEmail}
			customerPhone={customerPhone}
			notes={notes}
			formError={formError}
			isBooking={bookMutation.isPending}
			onCustomerNameChange={setCustomerName}
			onCustomerEmailChange={setCustomerEmail}
			onCustomerPhoneChange={setCustomerPhone}
			onNotesChange={setNotes}
			onBook={handleBook}
			// Confirmed step
			confirmedAppointment={confirmedAppointment}
			// Shared
			onBack={handleBack}
			formatCurrency={formatCurrency}
			formatDuration={formatDuration}
			formatTime={formatTime}
			statusColors={STATUS_COLORS}
			statusLabels={STATUS_LABELS}
		/>
	);
}
