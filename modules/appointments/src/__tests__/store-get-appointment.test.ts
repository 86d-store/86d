import { describe, expect, it, vi } from "vitest";
import type { Appointment, AppointmentController } from "../service";
import { getAppointment } from "../store/endpoints/get-appointment";

function extractHandler(
	endpoint: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const record = endpoint as Record<string, unknown>;
	const handler =
		typeof record.handler === "function" ? record.handler : endpoint;
	return handler as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
	const now = new Date("2026-08-28T12:00:00Z");
	return {
		id: "appointment_1",
		serviceId: "service_1",
		staffId: "staff_1",
		customerId: "customer_1",
		customerName: "Alex Customer",
		customerEmail: "alex@example.com",
		startsAt: now,
		endsAt: new Date(now.getTime() + 30 * 60_000),
		status: "pending",
		price: 12000,
		currency: "USD",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(appointment: Appointment | null) {
	return {
		getAppointment: vi.fn().mockResolvedValue(appointment),
	} satisfies Pick<AppointmentController, "getAppointment">;
}

const handler = extractHandler(getAppointment);

function call(
	controller: Pick<AppointmentController, "getAppointment">,
	customerId?: string,
) {
	return handler({
		params: { id: "appointment_1" },
		context: {
			session: customerId ? { user: { id: customerId } } : undefined,
			controllers: { appointments: controller },
		},
	});
}

describe("store GET /appointments/:id", () => {
	it("requires a signed-in customer before looking up an appointment", async () => {
		const controller = makeController(makeAppointment());

		expect(await call(controller)).toEqual({
			error: "Authentication required",
			status: 401,
		});
		expect(controller.getAppointment).not.toHaveBeenCalled();
	});

	it("does not reveal another customer's appointment", async () => {
		const controller = makeController(makeAppointment());

		expect(await call(controller, "customer_2")).toEqual({
			error: "Appointment not found",
			status: 404,
		});
	});

	it("returns an appointment to its customer", async () => {
		const appointment = makeAppointment();
		const controller = makeController(appointment);

		expect(await call(controller, "customer_1")).toEqual({ appointment });
	});

	it("does not expose guest appointments through the customer route", async () => {
		const controller = makeController(
			makeAppointment({ customerId: undefined }),
		);

		expect(await call(controller, "customer_1")).toEqual({
			error: "Appointment not found",
			status: 404,
		});
	});
});
