import type { ModuleController } from "@86d-app/core/types/module";

/** An announcement displayed to store visitors */
export type Announcement = {
	id: string;
	/** Short heading displayed in the announcement */
	title: string;
	/** Body text or HTML content */
	content: string;
	/** Display format: bar (thin strip), banner (wider block), or popup (modal overlay) */
	type: "bar" | "banner" | "popup";
	/** Screen position: top or bottom of viewport */
	position: "top" | "bottom";
	/** Optional CTA link URL */
	linkUrl?: string | undefined;
	/** Optional CTA link label */
	linkText?: string | undefined;
	/** CSS background color (e.g., "#1a1a2e" or "oklch(0.5 0.2 240)") */
	backgroundColor?: string | undefined;
	/** CSS text color */
	textColor?: string | undefined;
	/** Icon identifier (e.g., "Megaphone", "Truck", "Tag") */
	iconName?: string | undefined;
	/** Display order — lower numbers appear first */
	priority: number;
	/** Whether the announcement is currently enabled */
	isActive: boolean;
	/** Whether visitors can dismiss this announcement */
	isDismissible: boolean;
	/** Scheduled start time (null = immediately visible) */
	startsAt?: Date | undefined;
	/** Scheduled end time (null = no expiry) */
	endsAt?: Date | undefined;
	/** Which visitors see this announcement */
	targetAudience: "all" | "authenticated" | "guest";
	/** Total number of times this announcement was shown */
	impressions: number;
	/** Total number of CTA link clicks */
	clicks: number;
	/** Total number of times visitors dismissed this */
	dismissals: number;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type AnnouncementsController = ModuleController & {
	/** Create a new announcement */
	createAnnouncement(params: {
		title: string;
		content: string;
		type?: "bar" | "banner" | "popup" | undefined;
		position?: "top" | "bottom" | undefined;
		linkUrl?: string | undefined;
		linkText?: string | undefined;
		backgroundColor?: string | undefined;
		textColor?: string | undefined;
		iconName?: string | undefined;
		priority?: number | undefined;
		isDismissible?: boolean | undefined;
		startsAt?: Date | undefined;
		endsAt?: Date | undefined;
		targetAudience?: "all" | "authenticated" | "guest" | undefined;
	}): Promise<Announcement>;

	/** Get an announcement by ID */
	getAnnouncement(id: string): Promise<Announcement | null>;

	/** List all announcements with optional filters */
	listAnnouncements(opts?: {
		activeOnly?: boolean | undefined;
		type?: "bar" | "banner" | "popup" | undefined;
		position?: "top" | "bottom" | undefined;
		limit?: number | undefined;
		offset?: number | undefined;
	}): Promise<Announcement[]>;

	/** Get announcements currently visible to visitors */
	getActiveAnnouncements(opts?: {
		audience?: "all" | "authenticated" | "guest" | undefined;
	}): Promise<Announcement[]>;

	/** Update an announcement */
	updateAnnouncement(
		id: string,
		data: {
			title?: string | undefined;
			content?: string | undefined;
			type?: "bar" | "banner" | "popup" | undefined;
			position?: "top" | "bottom" | undefined;
			linkUrl?: string | undefined;
			linkText?: string | undefined;
			backgroundColor?: string | undefined;
			textColor?: string | undefined;
			iconName?: string | undefined;
			priority?: number | undefined;
			isActive?: boolean | undefined;
			isDismissible?: boolean | undefined;
			startsAt?: Date | undefined;
			endsAt?: Date | undefined;
			targetAudience?: "all" | "authenticated" | "guest" | undefined;
		},
	): Promise<Announcement>;

	/** Delete an announcement */
	deleteAnnouncement(id: string): Promise<void>;

	/** Reorder announcements by providing an ordered list of IDs */
	reorderAnnouncements(ids: string[]): Promise<void>;

	/** Increment impression count */
	recordImpression(id: string): Promise<void>;

	/** Increment click count */
	recordClick(id: string): Promise<void>;

	/** Increment dismissal count */
	recordDismissal(id: string): Promise<void>;

	/** Get aggregate statistics */
	getStats(): Promise<{
		totalAnnouncements: number;
		activeAnnouncements: number;
		scheduledAnnouncements: number;
		expiredAnnouncements: number;
		totalImpressions: number;
		totalClicks: number;
		totalDismissals: number;
		clickRate: number;
		dismissRate: number;
	}>;
};
