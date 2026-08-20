import type { ModuleController } from "@86d-app/core/types/module";

/** Supported form field types */
export type FormFieldType =
	| "text"
	| "email"
	| "textarea"
	| "number"
	| "phone"
	| "select"
	| "radio"
	| "checkbox"
	| "date"
	| "url"
	| "hidden";

/** A single field definition within a form */
export type FormField = {
	name: string;
	label: string;
	type: FormFieldType;
	required: boolean;
	placeholder?: string | undefined;
	defaultValue?: string | undefined;
	/** For select/radio: list of allowed values */
	options?: string[] | undefined;
	/** Regex pattern for validation */
	pattern?: string | undefined;
	/** Min length for text, min value for number */
	min?: number | undefined;
	/** Max length for text, max value for number */
	max?: number | undefined;
	/** Display position */
	position: number;
};

export type Form = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	fields: FormField[];
	submitLabel: string;
	successMessage: string;
	isActive: boolean;
	notifyEmail?: string | undefined;
	honeypotEnabled: boolean;
	maxSubmissions: number;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type SubmissionStatus = "unread" | "read" | "spam" | "archived";

export type FormSubmission = {
	id: string;
	formId: string;
	values: Record<string, unknown>;
	ipAddress?: string | undefined;
	status: SubmissionStatus;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
};

export type FormsController = ModuleController & {
	// --- Form CRUD ---

	/** Create a new form definition */
	createForm(params: {
		name: string;
		slug: string;
		description?: string | undefined;
		fields?: FormField[] | undefined;
		submitLabel?: string | undefined;
		successMessage?: string | undefined;
		notifyEmail?: string | undefined;
		honeypotEnabled?: boolean | undefined;
		maxSubmissions?: number | undefined;
	}): Promise<Form>;

	/** Get a form by ID */
	getForm(id: string): Promise<Form | null>;

	/** Get a form by slug */
	getFormBySlug(slug: string): Promise<Form | null>;

	/** List all forms */
	listForms(opts?: { activeOnly?: boolean | undefined }): Promise<Form[]>;

	/** Update a form */
	updateForm(
		id: string,
		data: {
			name?: string | undefined;
			slug?: string | undefined;
			description?: string | undefined;
			fields?: FormField[] | undefined;
			submitLabel?: string | undefined;
			successMessage?: string | undefined;
			isActive?: boolean | undefined;
			notifyEmail?: string | undefined;
			honeypotEnabled?: boolean | undefined;
			maxSubmissions?: number | undefined;
		},
	): Promise<Form>;

	/** Delete a form and all its submissions */
	deleteForm(id: string): Promise<void>;

	// --- Submissions ---

	/** Submit a form (customer-facing) */
	submitForm(params: {
		formId: string;
		values: Record<string, unknown>;
		ipAddress?: string | undefined;
	}): Promise<FormSubmission>;

	/** Get a submission by ID */
	getSubmission(id: string): Promise<FormSubmission | null>;

	/** List submissions for a form */
	listSubmissions(opts?: {
		formId?: string | undefined;
		status?: SubmissionStatus | undefined;
		limit?: number | undefined;
		offset?: number | undefined;
	}): Promise<FormSubmission[]>;

	/** Update submission status (read, spam, archived) */
	updateSubmissionStatus(
		id: string,
		status: SubmissionStatus,
	): Promise<FormSubmission>;

	/** Delete a submission */
	deleteSubmission(id: string): Promise<void>;

	/** Bulk delete submissions */
	bulkDeleteSubmissions(ids: string[]): Promise<number>;

	/** Get form statistics */
	getStats(formId?: string | undefined): Promise<{
		totalForms: number;
		totalSubmissions: number;
		unreadCount: number;
		spamCount: number;
	}>;
};
