"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import SettingsCommerceTemplate from "./settings-commerce.mdx";

interface StoreSetting {
	id: string;
	key: string;
	value: string;
	group: string;
	updatedAt: string;
}

function useSettingsApi() {
	const client = useModuleClient();
	return {
		list: client.module("settings").admin["/admin/settings"],
		updateBulk: client.module("settings").admin["/admin/settings/update-bulk"],
	};
}

export function SettingsCommerce() {
	const api = useSettingsApi();
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const { data, isLoading } = api.list.useQuery({
		group: "commerce",
	}) as {
		data: { settings: StoreSetting[] } | undefined;
		isLoading: boolean;
	};

	const updateBulk = api.updateBulk.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			setSaving(false);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		},
		onError: () => setSaving(false),
	});

	const settings = data?.settings ?? [];
	const getValue = (key: string) =>
		settings.find((s) => s.key === key)?.value ?? "";

	const [currency, setCurrency] = useState<string | null>(null);
	const [weightUnit, setWeightUnit] = useState<string | null>(null);
	const [dimensionUnit, setDimensionUnit] = useState<string | null>(null);
	const [orderPrefix, setOrderPrefix] = useState<string | null>(null);
	const [taxIncluded, setTaxIncluded] = useState<string | null>(null);

	const currentCurrency = currency ?? getValue("commerce.currency");
	const currentWeightUnit = weightUnit ?? getValue("commerce.weight_unit");
	const currentDimensionUnit =
		dimensionUnit ?? getValue("commerce.dimension_unit");
	const currentOrderPrefix = orderPrefix ?? getValue("commerce.order_prefix");
	const currentTaxIncluded = taxIncluded ?? getValue("commerce.tax_included");

	const handleSave = () => {
		setSaving(true);
		updateBulk.mutate({
			settings: [
				{
					key: "commerce.currency",
					value: currentCurrency,
					group: "commerce",
				},
				{
					key: "commerce.weight_unit",
					value: currentWeightUnit,
					group: "commerce",
				},
				{
					key: "commerce.dimension_unit",
					value: currentDimensionUnit,
					group: "commerce",
				},
				{
					key: "commerce.order_prefix",
					value: currentOrderPrefix,
					group: "commerce",
				},
				{
					key: "commerce.tax_included",
					value: currentTaxIncluded,
					group: "commerce",
				},
			],
		});
	};

	return (
		<SettingsCommerceTemplate
			loading={isLoading}
			saving={saving}
			saved={saved}
			currency={currentCurrency}
			onCurrencyChange={(v: string) => setCurrency(v)}
			weightUnit={currentWeightUnit}
			onWeightUnitChange={(v: string) => setWeightUnit(v)}
			dimensionUnit={currentDimensionUnit}
			onDimensionUnitChange={(v: string) => setDimensionUnit(v)}
			orderPrefix={currentOrderPrefix}
			onOrderPrefixChange={(v: string) => setOrderPrefix(v)}
			taxIncluded={currentTaxIncluded}
			onTaxIncludedChange={(v: string) => setTaxIncluded(v)}
			onSave={handleSave}
		/>
	);
}
