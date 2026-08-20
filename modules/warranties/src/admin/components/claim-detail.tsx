"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ClaimDetailTemplate from "./claim-detail.mdx";

interface ClaimData {
	id: string;
	warrantyRegistrationId: string;
	customerId: string;
	issueType: string;
	issueDescription: string;
	status: string;
	resolution?: string;
	resolutionNotes?: string;
	adminNotes?: string;
	submittedAt: string;
	resolvedAt?: string;
}

function extractError(err: unknown, fallback = "Action failed"): string {
	const e = err as { message?: string } | null;
	return typeof e?.message === "string" ? e.message : fallback;
}

function useClaimApi() {
	const client = useModuleClient();
	return {
		getClaim: client.module("warranties").admin["/admin/warranties/claims/:id"],
		approve:
			client.module("warranties").admin["/admin/warranties/claims/:id/approve"],
		deny: client.module("warranties").admin[
			"/admin/warranties/claims/:id/deny"
		],
		review:
			client.module("warranties").admin["/admin/warranties/claims/:id/review"],
		repair:
			client.module("warranties").admin["/admin/warranties/claims/:id/repair"],
		resolve:
			client.module("warranties").admin["/admin/warranties/claims/:id/resolve"],
		close:
			client.module("warranties").admin["/admin/warranties/claims/:id/close"],
	};
}

export function ClaimDetail({ claimId }: { claimId: string }) {
	const api = useClaimApi();
	const [actionError, setActionError] = useState("");
	const [resolution, setResolution] = useState<
		"repair" | "replace" | "refund" | "credit"
	>("repair");
	const [adminNotes, setAdminNotes] = useState("");
	const [denyReason, setDenyReason] = useState("");

	const {
		data,
		isLoading: loading,
		refetch,
	} = api.getClaim.useQuery({
		id: claimId,
	}) as {
		data: { claim: ClaimData } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const claim = data?.claim;

	const onMutationSuccess = () => {
		setActionError("");
		void refetch();
	};
	const onMutationError = (err: Error) => setActionError(extractError(err));

	const approveMutation = api.approve.useMutation({
		onSuccess: onMutationSuccess,
		onError: onMutationError,
	});
	const denyMutation = api.deny.useMutation({
		onSuccess: onMutationSuccess,
		onError: onMutationError,
	});
	const reviewMutation = api.review.useMutation({
		onSuccess: onMutationSuccess,
		onError: onMutationError,
	});
	const repairMutation = api.repair.useMutation({
		onSuccess: onMutationSuccess,
		onError: onMutationError,
	});
	const resolveMutation = api.resolve.useMutation({
		onSuccess: onMutationSuccess,
		onError: onMutationError,
	});
	const closeMutation = api.close.useMutation({
		onSuccess: onMutationSuccess,
		onError: onMutationError,
	});

	const isPending =
		approveMutation.isPending ||
		denyMutation.isPending ||
		reviewMutation.isPending ||
		repairMutation.isPending ||
		resolveMutation.isPending ||
		closeMutation.isPending;

	const handleApprove = (e: React.FormEvent) => {
		e.preventDefault();
		setActionError("");
		approveMutation.mutate({
			params: { id: claimId },
			resolution,
			...(adminNotes.trim() ? { adminNotes: adminNotes.trim() } : {}),
		});
	};

	const handleDeny = (e: React.FormEvent) => {
		e.preventDefault();
		setActionError("");
		denyMutation.mutate({
			params: { id: claimId },
			...(denyReason.trim() ? { reason: denyReason.trim() } : {}),
		});
	};

	return (
		<ClaimDetailTemplate
			claim={claim}
			loading={loading}
			actionError={actionError}
			isPending={isPending}
			resolution={resolution}
			adminNotes={adminNotes}
			denyReason={denyReason}
			onResolutionChange={setResolution}
			onAdminNotesChange={setAdminNotes}
			onDenyReasonChange={setDenyReason}
			onApprove={handleApprove}
			onDeny={handleDeny}
			onMarkUnderReview={() => {
				setActionError("");
				reviewMutation.mutate({ params: { id: claimId } });
			}}
			onMarkInRepair={() => {
				setActionError("");
				repairMutation.mutate({ params: { id: claimId } });
			}}
			onResolve={() => {
				setActionError("");
				resolveMutation.mutate({ params: { id: claimId } });
			}}
			onClose={() => {
				setActionError("");
				closeMutation.mutate({ params: { id: claimId } });
			}}
		/>
	);
}
