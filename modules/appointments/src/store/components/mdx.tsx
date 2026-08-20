"use client";

import type { MDXComponents } from "mdx/types";
import { AppointmentBooking } from "./appointment-booking";
import { MyAppointments } from "./my-appointments";

export default {
	AppointmentBooking,
	MyAppointments,
} satisfies MDXComponents;
