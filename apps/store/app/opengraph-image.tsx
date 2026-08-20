import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const alt = "86d Store";
export const size = {
	width: 1200,
	height: 630,
};

export default function Image() {
	return new ImageResponse(
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				background: "linear-gradient(135deg, #09090b 0%, #18181b 100%)",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: "24px",
				}}
			>
				<div
					style={{
						fontSize: "72px",
						fontWeight: 800,
						color: "#fafafa",
						letterSpacing: "-0.02em",
					}}
				>
					86d Store
				</div>
				<div
					style={{
						fontSize: "24px",
						color: "#a1a1aa",
						maxWidth: "600px",
						textAlign: "center",
						lineHeight: "1.5",
					}}
				>
					Dynamic commerce, built for developers.
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
