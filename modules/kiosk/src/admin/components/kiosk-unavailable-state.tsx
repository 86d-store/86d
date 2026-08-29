import { Alert, AlertDescription, AlertTitle } from "@86d-app/ui/alert";
import { Button } from "@86d-app/ui/button";
import { View } from "@86d-app/ui/view";

export function KioskUnavailableState({
	kind,
	onRetry,
}: {
	kind: "stations" | "sessions";
	onRetry: () => void;
}) {
	const stations = kind === "stations";
	return (
		<Alert
			variant="destructive"
			role="alert"
			data-testid={`kiosk-${kind}-unavailable`}
		>
			<AlertTitle>
				{stations
					? "Station registrations are unavailable"
					: "Legacy session records are unavailable"}
			</AlertTitle>
			<AlertDescription>
				{stations
					? "Station registration records could not be loaded. Your records have not changed."
					: "Stored session lifecycle records and station registration names could not be loaded. Your records have not changed."}
			</AlertDescription>
			<View className="mt-3">
				<Button
					type="button"
					variant="outline"
					onClick={onRetry}
					aria-label={`Retry loading kiosk ${kind}`}
				>
					Try again
				</Button>
			</View>
		</Alert>
	);
}
