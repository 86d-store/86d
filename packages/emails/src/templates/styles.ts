/** Shared inline styles for email templates. */

export const colors = {
	text: "#1a1a1a",
	muted: "#6b7280",
	border: "#e5e7eb",
	bg: "#ffffff",
	bgMuted: "#f9fafb",
	primary: "#111827",
	primaryText: "#ffffff",
	success: "#059669",
	warning: "#d97706",
	error: "#dc2626",
} as const;

export const container: React.CSSProperties = {
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	maxWidth: 600,
	margin: "0 auto",
	backgroundColor: colors.bg,
	color: colors.text,
	lineHeight: "1.6",
};

export const header: React.CSSProperties = {
	padding: "32px 40px 24px",
	borderBottom: `1px solid ${colors.border}`,
};

export const storeName: React.CSSProperties = {
	fontSize: 18,
	fontWeight: 700,
	color: colors.text,
	margin: 0,
	letterSpacing: "-0.025em",
};

export const body: React.CSSProperties = {
	padding: "32px 40px",
};

export const heading: React.CSSProperties = {
	fontSize: 22,
	fontWeight: 700,
	color: colors.text,
	margin: "0 0 8px",
	letterSpacing: "-0.025em",
};

export const paragraph: React.CSSProperties = {
	fontSize: 15,
	color: colors.text,
	margin: "0 0 16px",
	lineHeight: "1.6",
};

export const mutedText: React.CSSProperties = {
	fontSize: 14,
	color: colors.muted,
	margin: "0 0 16px",
};

export const button: React.CSSProperties = {
	display: "inline-block",
	backgroundColor: colors.primary,
	color: colors.primaryText,
	fontSize: 14,
	fontWeight: 600,
	padding: "12px 24px",
	borderRadius: 6,
	textDecoration: "none",
	textAlign: "center",
};

export const footer: React.CSSProperties = {
	padding: "24px 40px",
	borderTop: `1px solid ${colors.border}`,
	textAlign: "center",
};

export const footerText: React.CSSProperties = {
	fontSize: 13,
	color: colors.muted,
	margin: 0,
	lineHeight: "1.5",
};

export const divider: React.CSSProperties = {
	borderTop: `1px solid ${colors.border}`,
	margin: "24px 0",
};

export const tableRow: React.CSSProperties = {
	borderBottom: `1px solid ${colors.border}`,
};

export const tableHeader: React.CSSProperties = {
	fontSize: 12,
	fontWeight: 600,
	color: colors.muted,
	textTransform: "uppercase" as const,
	letterSpacing: "0.05em",
	padding: "8px 0",
	textAlign: "left" as const,
};

export const tableCell: React.CSSProperties = {
	fontSize: 14,
	color: colors.text,
	padding: "12px 0",
	verticalAlign: "top",
};

export const summaryRow: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	fontSize: 14,
	padding: "4px 0",
};

export const badge: React.CSSProperties = {
	display: "inline-block",
	fontSize: 12,
	fontWeight: 600,
	padding: "2px 8px",
	borderRadius: 4,
};

export function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(amount / 100);
}

export function formatDate(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}
