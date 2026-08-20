import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AffiliateController } from "../../service";

export const approveConversionEndpoint = createAdminEndpoint(
	"/admin/affiliates/conversions/:id/approve",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;
		const conversion = await controller.approveConversion(ctx.params.id);
		if (!conversion) return { error: "Unable to approve conversion" };
		void ctx.context.events?.emit("affiliates.conversion_recorded", {
			conversionId: conversion.id,
			affiliateId: conversion.affiliateId,
			orderId: conversion.orderId,
			amount: conversion.orderAmount,
			commission: conversion.commissionAmount,
		});
		return { conversion };
	},
);
