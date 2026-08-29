"use client";

import { Button } from "@86d-app/ui/button";
import {
	FormSheet,
	FormSheetBody,
	FormSheetClose,
	FormSheetContent,
	FormSheetDescription,
	FormSheetError,
	FormSheetFooter,
	FormSheetHeader,
	FormSheetTitle,
} from "@86d-app/ui/console/form-sheet";
import { Checkbox } from "@86d-app/ui/shadcn/checkbox";
import { Input } from "@86d-app/ui/shadcn/input";
import { Label } from "@86d-app/ui/shadcn/label";
import { Text } from "@86d-app/ui/text";
import { View } from "@86d-app/ui/view";
import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import type { AdminKioskStation } from "./kiosk-admin-types";
import {
	createStationFormDefaults,
	stationFormErrorMessage,
	stationFormSchema,
} from "./station-form-schema";
import { useKioskApi } from "./use-kiosk-api";

export interface StationSheetProps {
	station?: AdminKioskStation;
	onSaved: () => void;
	onCancel: () => void;
}

export const CREATE_STATION_AMBIGUOUS_ERROR =
	"Station may have been registered. Close this panel and check station registrations before trying again.";
export const UPDATE_STATION_ERROR =
	"Station changes could not be saved. Try again.";

export function StationSheet({
	station,
	onSaved,
	onCancel,
}: StationSheetProps) {
	const api = useKioskApi();
	const isEditing = station !== undefined;
	const [submitError, setSubmitError] = useState<string | null>(null);
	const firstInputRef = useRef<HTMLInputElement>(null);

	const createMutation = api.createStation.useMutation({
		onSuccess: () => {
			void api.listStations.invalidate();
			void api.listStationOptions.invalidate();
			onSaved();
		},
		onError: () => {
			void api.listStations.invalidate();
			void api.listStationOptions.invalidate();
			setSubmitError(CREATE_STATION_AMBIGUOUS_ERROR);
		},
	});

	const updateMutation = api.updateStation.useMutation({
		onSuccess: () => {
			void api.listStations.invalidate();
			void api.listStationOptions.invalidate();
			onSaved();
		},
		onError: () => setSubmitError(UPDATE_STATION_ERROR),
	});

	const form = useForm({
		defaultValues: createStationFormDefaults(station),
		validators: {
			onSubmit: stationFormSchema,
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			if (station) {
				await updateMutation.mutateAsync({
					params: { id: station.id },
					body: {
						name: value.name.trim(),
						location: value.location.trim() || null,
						isActive: value.isActive,
					},
				});
				return;
			}
			await createMutation.mutateAsync({
				body: {
					name: value.name.trim(),
					location: value.location.trim() || undefined,
				},
			});
		},
	});

	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<FormSheet
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) onCancel();
			}}
		>
			<FormSheetContent
				size="md"
				onSubmit={() => {
					setSubmitError(null);
					void form.handleSubmit();
				}}
			>
				<FormSheetHeader>
					<FormSheetTitle>
						{isEditing ? "Edit station" : "New station"}
					</FormSheetTitle>
					<FormSheetDescription>
						{isEditing
							? "Update this station registration record."
							: "Add a station registration record."}
					</FormSheetDescription>
				</FormSheetHeader>

				<FormSheetBody>
					<FormSheetError>{submitError}</FormSheetError>
					<form.Field name="name">
						{(field) => {
							const error = stationFormErrorMessage(field.state.meta.errors[0]);
							return (
								<View className="space-y-2">
									<Label htmlFor={field.name}>
										Name <Text className="text-destructive">*</Text>
									</Label>
									<Input
										id={field.name}
										name={field.name}
										ref={firstInputRef}
										value={field.state.value}
										maxLength={200}
										placeholder="Front counter"
										aria-invalid={error !== undefined}
										aria-describedby={error ? `${field.name}-error` : undefined}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
									/>
									{error ? (
										<Text
											id={`${field.name}-error`}
											variant="p"
											className="text-destructive text-xs"
										>
											{error}
										</Text>
									) : null}
								</View>
							);
						}}
					</form.Field>

					<form.Field name="location">
						{(field) => {
							const error = stationFormErrorMessage(field.state.meta.errors[0]);
							return (
								<View className="space-y-2">
									<Label htmlFor={field.name}>Location</Label>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										maxLength={500}
										placeholder="Lobby, gate A, etc."
										aria-invalid={error !== undefined}
										aria-describedby={error ? `${field.name}-error` : undefined}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
									/>
									{error ? (
										<Text
											id={`${field.name}-error`}
											variant="p"
											className="text-destructive text-xs"
										>
											{error}
										</Text>
									) : null}
								</View>
							);
						}}
					</form.Field>

					{isEditing ? (
						<form.Field name="isActive">
							{(field) => (
								<Label className="min-h-11 cursor-pointer">
									<Checkbox
										checked={field.state.value}
										onCheckedChange={(checked) => field.handleChange(checked)}
									/>
									Registration enabled
								</Label>
							)}
						</form.Field>
					) : null}
				</FormSheetBody>

				<FormSheetFooter>
					<FormSheetClose disabled={isPending}>Cancel</FormSheetClose>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting] as const}
					>
						{([canSubmit, isSubmitting]) => (
							<Button
								type="submit"
								disabled={!canSubmit || isSubmitting || isPending}
							>
								{isSubmitting || isPending
									? isEditing
										? "Saving..."
										: "Creating..."
									: isEditing
										? "Save changes"
										: "Create station"}
							</Button>
						)}
					</form.Subscribe>
				</FormSheetFooter>
			</FormSheetContent>
		</FormSheet>
	);
}
