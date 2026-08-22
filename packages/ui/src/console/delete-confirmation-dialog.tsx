"use client";

import { TrashIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/core/alert-dialog";
import { Button } from "~/core/button";
import { Field, FieldLabel } from "~/core/field";
import { Input } from "~/core/input";
import { Spinner } from "~/core/spinner";

export interface DeleteConfirmationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entityName: string;
	entityType: string;
	onConfirm: () => void;
	isDeleting?: boolean;
}

export function DeleteConfirmationDialog({
	open,
	onOpenChange,
	entityName,
	entityType,
	onConfirm,
	isDeleting = false,
}: DeleteConfirmationDialogProps) {
	const [confirmationInput, setConfirmationInput] = useState("");

	const isConfirmed = confirmationInput === entityName;

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setConfirmationInput("");
		}
		onOpenChange(open);
	};

	const handleConfirm = () => {
		if (isConfirmed) {
			onConfirm();
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Confirmation</AlertDialogTitle>
					<AlertDialogDescription className="size-full">
						Are you sure you want to delete the "{entityName}" {entityType}?
						<Field className="mt-2">
							<FieldLabel
								htmlFor="confirmation-input"
								className="flex items-center text-sm"
							>
								Enter
								<span className="mx-1 font-mono font-semibold text-destructive text-xs">
									{entityName}
								</span>
								below to confirm:
							</FieldLabel>
							<Input
								id="confirmation-input"
								value={confirmationInput}
								onChange={(e) => setConfirmationInput(e.target.value)}
								placeholder={entityName}
								autoComplete="off"
							/>
						</Field>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<Button
						variant="destructive"
						onClick={handleConfirm}
						disabled={!isConfirmed || isDeleting}
					>
						{isDeleting ? (
							<Spinner data-icon="inline-start" />
						) : (
							<TrashIcon weight="bold" data-icon="inline-start" />
						)}
						Delete
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
