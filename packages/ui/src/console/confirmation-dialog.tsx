"use client";

import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import type * as React from "react";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "~/core/alert-dialog";
import { Spinner } from "~/core/spinner";
import { HoldToConfirmButton } from "./hold-to-confirm-button";

export interface ConfirmationDialogProps
	extends Omit<React.ComponentProps<typeof AlertDialog>, "onOpenChange"> {
	title: string;
	description: React.ReactNode;
	confirmLabel?: string;
	onConfirm: () => void;
	isLoading?: boolean;
	loading?: boolean;
	variant?: React.ComponentProps<typeof HoldToConfirmButton>["variant"];
	onOpenChange?: (open: boolean) => void;
}

export function ConfirmationDialog({
	title,
	description,
	confirmLabel = "Press and hold",
	onConfirm,
	isLoading = false,
	loading = false,
	variant = "destructive",
	onOpenChange,
	...props
}: ConfirmationDialogProps) {
	const pending = isLoading || loading;

	const handleOpenChange = (open: boolean) => {
		onOpenChange?.(open);
	};

	const handleConfirm = () => {
		onOpenChange?.(false);
		onConfirm();
	};

	return (
		<AlertDialog {...props} onOpenChange={handleOpenChange}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogMedia className="bg-destructive/10">
						<WarningIcon weight="duotone" className="text-destructive" />
					</AlertDialogMedia>
					<AlertDialogTitle className="text-balance">{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
					<HoldToConfirmButton
						variant={variant}
						disabled={pending}
						onConfirm={handleConfirm}
					>
						{pending ? <Spinner data-icon="inline-start" /> : null}
						{confirmLabel}
					</HoldToConfirmButton>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
