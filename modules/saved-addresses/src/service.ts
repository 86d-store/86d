import type { ModuleController } from "@86d-app/core/types/module";

export type Address = {
	id: string;
	customerId: string;
	label?: string | undefined;
	firstName: string;
	lastName: string;
	company?: string | undefined;
	line1: string;
	line2?: string | undefined;
	city: string;
	state?: string | undefined;
	postalCode: string;
	country: string;
	phone?: string | undefined;
	isDefault: boolean;
	isDefaultBilling: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type AddressInput = {
	label?: string | undefined;
	firstName: string;
	lastName: string;
	company?: string | undefined;
	line1: string;
	line2?: string | undefined;
	city: string;
	state?: string | undefined;
	postalCode: string;
	country: string;
	phone?: string | undefined;
	isDefault?: boolean | undefined;
	isDefaultBilling?: boolean | undefined;
};

export type AddressSummary = {
	totalAddresses: number;
	countryCounts: Array<{ country: string; count: number }>;
};

export type SavedAddressesController = ModuleController & {
	create(customerId: string, input: AddressInput): Promise<Address>;

	update(
		customerId: string,
		addressId: string,
		input: Partial<AddressInput>,
	): Promise<Address | null>;

	delete(customerId: string, addressId: string): Promise<boolean>;

	getById(customerId: string, addressId: string): Promise<Address | null>;

	listByCustomer(
		customerId: string,
		params?: { take?: number | undefined; skip?: number | undefined },
	): Promise<Address[]>;

	getDefault(customerId: string): Promise<Address | null>;

	getDefaultBilling(customerId: string): Promise<Address | null>;

	setDefault(customerId: string, addressId: string): Promise<boolean>;

	setDefaultBilling(customerId: string, addressId: string): Promise<boolean>;

	countByCustomer(customerId: string): Promise<number>;

	/** Admin: list all addresses with optional filters. */
	listAll(params?: {
		customerId?: string | undefined;
		country?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<{ items: Address[]; total: number }>;

	/** Admin: get summary stats. */
	getSummary(): Promise<AddressSummary>;
};
