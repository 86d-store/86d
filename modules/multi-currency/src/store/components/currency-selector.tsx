"use client";

import { useState } from "react";
import { useCurrencyApi } from "./_hooks";
import CurrencySelectorTemplate from "./currency-selector.mdx";

interface Currency {
	id: string;
	code: string;
	name: string;
	symbol: string;
	isBase: boolean;
	isActive: boolean;
	sortOrder: number;
}

export interface CurrencySelectorProps {
	/** Currently selected currency code (ISO 4217) */
	value?: string | undefined;
	/** Called when user selects a different currency */
	onChange?: ((code: string) => void) | undefined;
	/** Show compact mode (code only, no name) */
	compact?: boolean | undefined;
}

export function CurrencySelector({
	value,
	onChange,
	compact = false,
}: CurrencySelectorProps) {
	const api = useCurrencyApi();
	const [isOpen, setIsOpen] = useState(false);

	const { data, isLoading } = api.listCurrencies.useQuery() as {
		data: { currencies: Currency[] } | undefined;
		isLoading: boolean;
	};

	const currencies = data?.currencies ?? [];
	const selected = currencies.find((c) => c.code === value);
	const baseCurrency = currencies.find((c) => c.isBase);
	const active = selected ?? baseCurrency ?? currencies[0];

	const handleSelect = (code: string) => {
		setIsOpen(false);
		onChange?.(code);
	};

	if (isLoading || currencies.length <= 1) {
		return null;
	}

	return (
		<CurrencySelectorTemplate
			currencies={currencies}
			active={active}
			isOpen={isOpen}
			onToggle={() => setIsOpen((prev) => !prev)}
			onSelect={handleSelect}
			compact={compact}
		/>
	);
}
