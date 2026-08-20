import type { ModuleController } from "@86d-app/core/types/module";

export type ServiceStatus = "active" | "inactive";
export type StaffStatus = "active" | "inactive";
export type AppointmentStatus =
	| "pending"
	| "confirmed"
	| "cancelled"
	| "completed"
	| "no-show";

export type Service = {
	id: string;
	name: string;
	slug: string;
	description?: string;
	duration: number;
	price: number;
	currency: string;
	status: ServiceStatus;
	maxCapacity: number;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
};

export type Staff = {
	id: string;
	name: string;
	email: string;
	bio?: string;
	status: StaffStatus;
	createdAt: Date;
	updatedAt: Date;
};

export type StaffService = {
	id: string;
	staffId: string;
	serviceId: string;
	createdAt: Date;
};

export type Schedule = {
	id: string;
	staffId: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	createdAt: Date;
};

export type Appointment = {
	id: string;
	serviceId: string;
	staffId: string;
	customerId?: string;
	customerName: string;
	customerEmail: string;
	customerPhone?: string;
	startsAt: Date;
	endsAt: Date;
	status: AppointmentStatus;
	notes?: string;
	price: number;
	currency: string;
	createdAt: Date;
	updatedAt: Date;
};

export type StaffWithServices = Staff & {
	services: Service[];
};

export type ServiceWithStaff = Service & {
	staff: Staff[];
};

export type TimeSlot = {
	startsAt: Date;
	endsAt: Date;
	staffId: string;
};

export type AppointmentStats = {
	totalAppointments: number;
	pendingAppointments: number;
	confirmedAppointments: number;
	cancelledAppointments: number;
	completedAppointments: number;
	noShowAppointments: number;
	totalServices: number;
	totalStaff: number;
	totalRevenue: number;
};

export type AppointmentController = ModuleController & {
	// ── Services ──

	createService(params: {
		name: string;
		slug: string;
		description?: string;
		duration: number;
		price: number;
		currency?: string;
		status?: ServiceStatus;
		maxCapacity?: number;
		sortOrder?: number;
	}): Promise<Service>;

	getService(id: string): Promise<Service | null>;

	getServiceBySlug(slug: string): Promise<Service | null>;

	updateService(
		id: string,
		params: {
			name?: string;
			slug?: string;
			description?: string | null;
			duration?: number;
			price?: number;
			currency?: string;
			status?: ServiceStatus;
			maxCapacity?: number;
			sortOrder?: number;
		},
	): Promise<Service | null>;

	deleteService(id: string): Promise<boolean>;

	listServices(params?: {
		status?: ServiceStatus;
		take?: number;
		skip?: number;
	}): Promise<Service[]>;

	countServices(params?: { status?: ServiceStatus }): Promise<number>;

	// ── Staff ──

	createStaff(params: {
		name: string;
		email: string;
		bio?: string;
		status?: StaffStatus;
	}): Promise<Staff>;

	getStaff(id: string): Promise<Staff | null>;

	updateStaff(
		id: string,
		params: {
			name?: string;
			email?: string;
			bio?: string | null;
			status?: StaffStatus;
		},
	): Promise<Staff | null>;

	deleteStaff(id: string): Promise<boolean>;

	listStaff(params?: {
		status?: StaffStatus;
		take?: number;
		skip?: number;
	}): Promise<Staff[]>;

	countStaff(params?: { status?: StaffStatus }): Promise<number>;

	// ── Staff–Service assignments ──

	assignService(staffId: string, serviceId: string): Promise<StaffService>;

	unassignService(staffId: string, serviceId: string): Promise<boolean>;

	getStaffServices(staffId: string): Promise<Service[]>;

	getServiceStaff(serviceId: string): Promise<Staff[]>;

	// ── Schedules ──

	setSchedule(params: {
		staffId: string;
		dayOfWeek: number;
		startTime: string;
		endTime: string;
	}): Promise<Schedule>;

	getSchedule(staffId: string): Promise<Schedule[]>;

	removeSchedule(staffId: string, dayOfWeek: number): Promise<boolean>;

	// ── Availability ──

	getAvailableSlots(params: {
		serviceId: string;
		staffId?: string;
		date: Date;
	}): Promise<TimeSlot[]>;

	// ── Appointments ──

	createAppointment(params: {
		serviceId: string;
		staffId: string;
		customerId?: string;
		customerName: string;
		customerEmail: string;
		customerPhone?: string;
		startsAt: Date;
		notes?: string;
	}): Promise<Appointment>;

	getAppointment(id: string): Promise<Appointment | null>;

	updateAppointment(
		id: string,
		params: {
			status?: AppointmentStatus;
			notes?: string | null;
			startsAt?: Date;
			staffId?: string;
		},
	): Promise<Appointment | null>;

	cancelAppointment(id: string): Promise<Appointment | null>;

	listAppointments(params?: {
		staffId?: string;
		serviceId?: string;
		customerId?: string;
		status?: AppointmentStatus;
		from?: Date;
		to?: Date;
		take?: number;
		skip?: number;
	}): Promise<Appointment[]>;

	countAppointments(params?: {
		staffId?: string;
		serviceId?: string;
		customerId?: string;
		status?: AppointmentStatus;
		from?: Date;
		to?: Date;
	}): Promise<number>;

	getUpcomingAppointments(params?: {
		staffId?: string;
		customerId?: string;
		take?: number;
	}): Promise<Appointment[]>;

	// ── Stats ──

	getStats(): Promise<AppointmentStats>;
};
