"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useCurrencyApi() {
	const client = useModuleClient();
	return {
		listCurrencies: client.module("multi-currency").admin["/admin/currencies"],
		getCurrency: client.module("multi-currency").admin["/admin/currencies/:id"],
		createCurrency:
			client.module("multi-currency").admin["/admin/currencies/create"],
		updateCurrency:
			client.module("multi-currency").admin["/admin/currencies/:id/update"],
		deleteCurrency:
			client.module("multi-currency").admin["/admin/currencies/:id/delete"],
		setBase:
			client.module("multi-currency").admin["/admin/currencies/:id/set-base"],
		updateRate:
			client.module("multi-currency").admin["/admin/currencies/update-rate"],
		rateHistory:
			client.module("multi-currency").admin["/admin/currencies/rate-history"],
	};
}

export interface Currency {
	id: string;
	code: string;
	name: string;
	symbol: string;
	decimalPlaces: number;
	exchangeRate: number;
	isBase: boolean;
	isActive: boolean;
	symbolPosition: string;
	thousandsSeparator?: string;
	decimalSeparator?: string;
	roundingMode: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}
