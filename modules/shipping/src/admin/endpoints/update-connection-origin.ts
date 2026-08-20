import { createAdminEndpoint } from "@86d-app/core/api";
import {
	type ShippingFoundationController,
	shippingAddressSchema,
} from "../../foundation-v2";
import {
	type ConnectionEndpointOptions,
	publicConnection,
} from "./get-connection";

export interface UpdateConnectionOriginOptions
	extends ConnectionEndpointOptions {
	easypostApiKey?: string | undefined;
	easypostTestMode?: boolean | undefined;
	easypostConnectionName: string;
}

export function createUpdateConnectionOriginEndpoint(
	options: UpdateConnectionOriginOptions,
) {
	return createAdminEndpoint(
		"/admin/shipping/connection/origin",
		{
			method: "POST",
			body: shippingAddressSchema,
		},
		async (ctx) => {
			if (!options.easypostApiKey) {
				return {
					error: "EasyPost API key is not configured.",
					status: 422,
				};
			}

			const foundation = ctx.context.controllers
				.shippingV2 as ShippingFoundationController;
			const originAddress = shippingAddressSchema.parse(ctx.body);
			const connectionId = options.easypostConnectionId;
			const existing = await foundation.getConnection(connectionId);

			let connection = existing;
			if (!connection) {
				connection = await foundation.ensureConnection({
					id: connectionId,
					name: options.easypostConnectionName,
					provider: "easypost",
					mode: options.easypostTestMode === false ? "live" : "test",
					capabilities: ["quote"],
					secretReference: "module-option:easypostApiKey",
					originAddress,
				});
			} else {
				connection = await foundation.updateConnectionOrigin(
					connectionId,
					originAddress,
				);
			}

			const checked = await foundation.checkConnection(connectionId);
			if (checked.health === "healthy") {
				connection = await foundation.enableConnection(connectionId);
			}

			return { connection: publicConnection(connection) };
		},
	);
}
