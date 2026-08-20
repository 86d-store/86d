import { createAdminEndpoint } from "@86d-app/core/api";
import type { ShippingFoundationController } from "../../foundation-v2";

export interface ConnectionEndpointOptions {
	easypostConnectionId: string;
}

export function publicConnection(connection: {
	id: string;
	name: string;
	provider: string;
	mode: string;
	capabilities: string[];
	health: string;
	lifecycle: string;
	originAddress: unknown;
	healthCheckedAt?: Date | undefined;
	enabledAt?: Date | undefined;
	disabledAt?: Date | undefined;
	revokedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
}) {
	const {
		id,
		name,
		provider,
		mode,
		capabilities,
		health,
		lifecycle,
		originAddress,
		healthCheckedAt,
		enabledAt,
		disabledAt,
		revokedAt,
		createdAt,
		updatedAt,
	} = connection;
	return {
		id,
		name,
		provider,
		mode,
		capabilities,
		health,
		lifecycle,
		originAddress,
		healthCheckedAt,
		enabledAt,
		disabledAt,
		revokedAt,
		createdAt,
		updatedAt,
	};
}

export function createGetConnectionEndpoint(
	options: ConnectionEndpointOptions,
) {
	return createAdminEndpoint(
		"/admin/shipping/connection",
		{ method: "GET" },
		async (ctx) => {
			const foundation = ctx.context.controllers
				.shippingV2 as ShippingFoundationController;
			const connection = await foundation.getConnection(
				options.easypostConnectionId,
			);
			return {
				connection: connection ? publicConnection(connection) : null,
			};
		},
	);
}
