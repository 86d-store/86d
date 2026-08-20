import type { ModuleController } from "@86d-app/core/types/module";

export type TargetType =
	| "product"
	| "collection"
	| "page"
	| "blog-post"
	| "custom";

export type Network =
	| "twitter"
	| "facebook"
	| "pinterest"
	| "linkedin"
	| "whatsapp"
	| "email"
	| "copy-link";

export type ShareEvent = {
	id: string;
	targetType: TargetType;
	targetId: string;
	network: Network;
	url: string;
	referrer?: string | undefined;
	sessionId?: string | undefined;
	createdAt: Date;
};

export type ShareSettings = {
	id: string;
	enabledNetworks: Network[];
	defaultMessage?: string | undefined;
	hashtags: string[];
	customTemplates: Record<string, string>;
	updatedAt: Date;
};

export type SocialSharingController = ModuleController & {
	recordShare(params: {
		targetType: TargetType;
		targetId: string;
		network: Network;
		url: string;
		referrer?: string | undefined;
		sessionId?: string | undefined;
	}): Promise<ShareEvent>;

	getShareCount(targetType: TargetType, targetId: string): Promise<number>;

	getShareCountByNetwork(
		targetType: TargetType,
		targetId: string,
	): Promise<Record<string, number>>;

	listShares(params?: {
		targetType?: TargetType | undefined;
		targetId?: string | undefined;
		network?: Network | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ShareEvent[]>;

	getTopShared(params?: {
		targetType?: TargetType | undefined;
		take?: number | undefined;
	}): Promise<Array<{ targetType: string; targetId: string; count: number }>>;

	getSettings(): Promise<ShareSettings | null>;

	updateSettings(params: {
		enabledNetworks?: Network[] | undefined;
		defaultMessage?: string | undefined;
		hashtags?: string[] | undefined;
		customTemplates?: Record<string, string> | undefined;
	}): Promise<ShareSettings>;

	generateShareUrl(
		network: Network,
		targetUrl: string,
		message?: string | undefined,
		hashtags?: string[] | undefined,
	): string;
};
