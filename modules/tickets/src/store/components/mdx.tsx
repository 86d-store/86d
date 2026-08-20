"use client";

import type { MDXComponents } from "mdx/types";
import { MyTickets } from "./my-tickets";
import { TicketDetail } from "./ticket-detail";
import { TicketForm } from "./ticket-form";

export { MyTickets, TicketDetail, TicketForm };

export default {
	MyTickets,
	TicketDetail,
	TicketForm,
} satisfies MDXComponents;
