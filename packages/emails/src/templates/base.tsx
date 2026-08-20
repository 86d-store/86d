import * as s from "./styles";

interface BaseEmailProps {
	children: React.ReactNode;
	preview?: string | undefined;
	storeName?: string | undefined;
}

export function BaseEmail({ children, preview, storeName }: BaseEmailProps) {
	return (
		<div
			style={{
				backgroundColor: "#f3f4f6",
				padding: "40px 16px",
				width: "100%",
			}}
		>
			{preview && (
				<div
					style={{
						display: "none",
						maxHeight: 0,
						overflow: "hidden",
						fontSize: 1,
						lineHeight: 1,
						color: "#f3f4f6",
					}}
				>
					{preview}
					{/* Pad preview text to prevent email clients from showing body text */}
					{"\u00A0".repeat(80)}
				</div>
			)}
			<div style={s.container}>
				{storeName && (
					<div style={s.header}>
						<p style={s.storeName}>{storeName}</p>
					</div>
				)}
				<div style={s.body}>{children}</div>
				<div style={s.footer}>
					<p style={s.footerText}>
						{storeName ? `${storeName} — Powered by 86d` : "Powered by 86d"}
					</p>
				</div>
			</div>
		</div>
	);
}
