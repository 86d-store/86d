import { z } from "@86d-store/core/zod";

const ordersResponse = z.object({
	orders: z.array(
		z.object({
			id: z.string().min(1),
			orderNumber: z.string().min(1),
			status: z.string().min(1),
			total: z.number().finite(),
			currency: z.string().regex(/^[a-zA-Z]{3}$/),
			createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
		}),
	),
	total: z.number().int().nonnegative(),
	page: z.number().int().positive(),
	limit: z.number().int().positive(),
	pages: z.number().int().nonnegative(),
});

export interface AccountOverviewOrder {
	id: string;
	href: string;
	number: string;
	status: string;
	total: string;
	date: string;
	dateTime: string;
}

export interface AccountOverviewIssue {
	title: string;
	description: string;
	canRetry: boolean;
	action: { href: string; label: string } | null;
}

export type AccountOverviewState =
	| { status: "loading" }
	| { status: "error"; issue: AccountOverviewIssue }
	| {
			status: "ready";
			orders: AccountOverviewOrder[];
			total: number;
			totalLabel: string;
			page: number;
			pages: number;
			pageLabel: string;
	  };

export interface AccountOverviewQuery {
	data: unknown;
	isPending: boolean;
	isError: boolean;
	error?: unknown;
}

const failureResponse = z.object({
	status: z.number().optional(),
	code: z.string().optional(),
	error: z.unknown().optional(),
	body: z.unknown().optional(),
});

function readAccountIssue(value: unknown): AccountOverviewIssue {
	const parsed = failureResponse.safeParse(value);
	const failure = parsed.success ? parsed.data : undefined;
	const parsedBody = failureResponse.safeParse(failure?.body);
	const response = parsedBody.success ? parsedBody.data : failure;
	const parsedError = failureResponse.safeParse(response?.error);
	const status = failure?.status ?? response?.status;
	const code =
		response?.code ?? (parsedError.success ? parsedError.data.code : undefined);

	if (status === 401) {
		return {
			title: "Sign in to view your orders",
			description:
				"Your session has expired. Sign in again to open your order history.",
			canRetry: false,
			action: { href: "/auth/signin?redirect=%2Faccount", label: "Sign in" },
		};
	}
	if (status === 403 && code === "CUSTOMER_EMAIL_VERIFICATION_REQUIRED") {
		return {
			title: "Verify your email to view your orders",
			description:
				"Your account's email address needs verification. Complete email verification, then try again. You can also track an order with the details from your confirmation.",
			canRetry: true,
			action: null,
		};
	}
	if (status === 403) {
		return {
			title: "Order history access is restricted",
			description:
				"This account cannot access order history. Contact the store for help, or track an order with the details from your confirmation.",
			canRetry: false,
			action: null,
		};
	}
	return {
		title: "Your orders could not be loaded",
		description:
			"Try again, or track an order using the details from your confirmation.",
		canRetry: true,
		action: null,
	};
}

export function readAccountOverview(
	query: AccountOverviewQuery,
): AccountOverviewState {
	if (query.isPending) return { status: "loading" };
	if (query.isError)
		return { status: "error", issue: readAccountIssue(query.error) };
	const parsed = ordersResponse.safeParse(query.data);
	if (!parsed.success)
		return { status: "error", issue: readAccountIssue(query.data) };
	const { orders, total, page, pages } = parsed.data;
	const date = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const count = new Intl.NumberFormat("en-US");

	return {
		status: "ready",
		orders: orders.map((order) => ({
			id: order.id,
			href: `/account/orders/${encodeURIComponent(order.id)}`,
			number: order.orderNumber,
			status: order.status,
			total: new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: order.currency,
			}).format(order.total / 100),
			date: date.format(new Date(order.createdAt)),
			dateTime: order.createdAt,
		})),
		total,
		totalLabel: `${count.format(total)} ${total === 1 ? "order" : "orders"}`,
		page,
		pages,
		pageLabel:
			page > Math.max(1, pages)
				? `Page ${count.format(page)}`
				: `Page ${count.format(page)} of ${count.format(Math.max(1, pages))}`,
	};
}
