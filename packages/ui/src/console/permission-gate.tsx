"use client";

import { observer } from "mobx-react-lite";
import { cloneElement, isValidElement, type ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/core/tooltip";
import { type AuthorityTarget, useAuthorityForTarget } from "~/hooks/use-user";

interface PermissionGateProps {
	permission: Record<string, string[]>;
	children: ReactElement<{ disabled?: boolean }>;
	fallbackMessage?: string;
	ownerOnly?: boolean;
	target?: AuthorityTarget;
}

interface AuthorityGateState {
	isLoading: boolean;
	isOwner: boolean;
	hasPermission(category: string, action: string): boolean;
}

export function isAuthorityAllowed(
	authority: AuthorityGateState,
	permission: Record<string, string[]>,
	ownerOnly = false,
): boolean {
	if (authority.isLoading || (ownerOnly && !authority.isOwner)) return false;
	return Object.entries(permission).every(([category, actions]) =>
		actions.every((action) => authority.hasPermission(category, action)),
	);
}

export function PermissionGatePrimitive({
	permission,
	children,
	fallbackMessage = "Insufficient permissions",
	ownerOnly = false,
	target,
}: PermissionGateProps) {
	const authority = useAuthorityForTarget(target);

	const allowed = isAuthorityAllowed(authority, permission, ownerOnly);

	const handleDeniedClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDeniedKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			e.stopPropagation();
		}
	};

	if (authority.isLoading) {
		return isValidElement(children)
			? cloneElement(children, { disabled: true })
			: children;
	}

	if (allowed) {
		return children;
	}

	if (!isValidElement(children)) {
		return children;
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						disabled
						className="inline-flex cursor-not-allowed border-0 bg-transparent p-0"
						style={{ pointerEvents: "auto" }}
						onClick={handleDeniedClick}
						onKeyDown={handleDeniedKeyDown}
						aria-label={fallbackMessage}
					/>
				}
			>
				{cloneElement(children, { disabled: true })}
			</TooltipTrigger>
			<TooltipContent>{fallbackMessage}</TooltipContent>
		</Tooltip>
	);
}

export const PermissionGate = observer(PermissionGatePrimitive);
