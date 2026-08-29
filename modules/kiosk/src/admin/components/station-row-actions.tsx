"use client";

import { Button } from "@86d-app/ui/button";
import { useState } from "react";
import type { AdminKioskStation } from "./kiosk-admin-types";
import { StationSheet } from "./station-sheet";

export function StationRowActions({
	station,
	context = "table",
}: {
	station: AdminKioskStation;
	context?: "table" | "mobile";
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				type="button"
				variant="ghost"
				onClick={() => setOpen(true)}
				aria-label={`Edit ${station.name}`}
				className={context === "mobile" ? "min-h-11 w-full" : undefined}
			>
				Edit
			</Button>
			{open ? (
				<StationSheet
					station={station}
					onSaved={() => setOpen(false)}
					onCancel={() => setOpen(false)}
				/>
			) : null}
		</>
	);
}
