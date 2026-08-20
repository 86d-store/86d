"use client";

import { formatCurrency } from "./_utils";
import TaxBreakdownTemplate from "./tax-breakdown.mdx";

interface TaxLineResult {
	productId: string;
	taxableAmount: number;
	taxAmount: number;
	rate: number;
	rateNames: string[];
}

export interface TaxCalculation {
	totalTax: number;
	shippingTax: number;
	lines: TaxLineResult[];
	effectiveRate: number;
	inclusive: boolean;
	jurisdiction: { country: string; state: string; city: string };
}

/**
 * Displays a detailed tax breakdown for a completed calculation.
 * Used in checkout summary and order receipts.
 */
export function TaxBreakdown({ calculation }: { calculation: TaxCalculation }) {
	return (
		<TaxBreakdownTemplate
			calculation={calculation}
			formatCurrency={formatCurrency}
		/>
	);
}
