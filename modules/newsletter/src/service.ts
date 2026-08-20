import type { ModuleController } from "@86d-app/core/types/module";

export type SubscriberStatus = "active" | "unsubscribed" | "bounced";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

export type Subscriber = {
	id: string;
	email: string;
	firstName?: string | undefined;
	lastName?: string | undefined;
	status: SubscriberStatus;
	source?: string | undefined;
	tags: string[];
	metadata: Record<string, unknown>;
	subscribedAt: Date;
	unsubscribedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type Campaign = {
	id: string;
	subject: string;
	body: string;
	status: CampaignStatus;
	recipientCount: number;
	sentCount: number;
	failedCount: number;
	tags: string[];
	scheduledAt?: Date | undefined;
	sentAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type CampaignStats = {
	total: number;
	draft: number;
	scheduled: number;
	sending: number;
	sent: number;
	totalRecipients: number;
	totalSent: number;
	totalFailed: number;
};

export type NewsletterController = ModuleController & {
	subscribe(params: {
		email: string;
		firstName?: string | undefined;
		lastName?: string | undefined;
		source?: string | undefined;
		tags?: string[] | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<Subscriber>;

	unsubscribe(email: string): Promise<Subscriber | null>;

	resubscribe(email: string): Promise<Subscriber | null>;

	getSubscriber(id: string): Promise<Subscriber | null>;

	getSubscriberByEmail(email: string): Promise<Subscriber | null>;

	updateSubscriber(
		id: string,
		params: {
			firstName?: string | undefined;
			lastName?: string | undefined;
			tags?: string[] | undefined;
			metadata?: Record<string, unknown> | undefined;
			status?: SubscriberStatus | undefined;
		},
	): Promise<Subscriber | null>;

	deleteSubscriber(id: string): Promise<boolean>;

	listSubscribers(params?: {
		status?: SubscriberStatus | undefined;
		tag?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Subscriber[]>;

	createCampaign(params: {
		subject: string;
		body: string;
		tags?: string[] | undefined;
		scheduledAt?: Date | undefined;
	}): Promise<Campaign>;

	getCampaign(id: string): Promise<Campaign | null>;

	updateCampaign(
		id: string,
		params: {
			subject?: string | undefined;
			body?: string | undefined;
			tags?: string[] | undefined;
			scheduledAt?: Date | undefined;
		},
	): Promise<Campaign | null>;

	deleteCampaign(id: string): Promise<boolean>;

	listCampaigns(params?: {
		status?: CampaignStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Campaign[]>;

	sendCampaign(id: string): Promise<Campaign | null>;

	getCampaignStats(): Promise<CampaignStats>;
};
