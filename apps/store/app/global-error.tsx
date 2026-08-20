"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[store global error]", error);
		Sentry.captureException(error);
	}, [error]);

	return (
		<html lang="en">
			<body>
				<div
					style={{
						display: "flex",
						minHeight: "100vh",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						padding: "1rem",
						textAlign: "center",
						fontFamily: "system-ui, sans-serif",
					}}
				>
					<p
						style={{
							fontSize: "4.5rem",
							fontWeight: 700,
							fontFamily: "monospace",
							color: "#999",
						}}
					>
						500
					</p>
					<h1
						style={{
							marginTop: "1rem",
							fontSize: "1.25rem",
							fontWeight: 600,
						}}
					>
						Something went wrong
					</h1>
					<p
						style={{
							marginTop: "0.5rem",
							maxWidth: "28rem",
							fontSize: "0.875rem",
							color: "#666",
						}}
					>
						A critical error occurred. Please try again or contact support if
						the issue persists.
					</p>
					<div
						style={{
							marginTop: "1.5rem",
							display: "flex",
							gap: "0.75rem",
						}}
					>
						<button
							type="button"
							onClick={reset}
							style={{
								padding: "0.5rem 1rem",
								fontSize: "0.875rem",
								fontWeight: 500,
								borderRadius: "0.375rem",
								border: "none",
								backgroundColor: "#111",
								color: "#fff",
								cursor: "pointer",
							}}
						>
							Try again
						</button>
						<a
							href="/"
							style={{
								padding: "0.5rem 1rem",
								fontSize: "0.875rem",
								fontWeight: 500,
								borderRadius: "0.375rem",
								border: "1px solid #ddd",
								backgroundColor: "transparent",
								color: "#111",
								textDecoration: "none",
							}}
						>
							Go home
						</a>
					</div>
				</div>
			</body>
		</html>
	);
}
