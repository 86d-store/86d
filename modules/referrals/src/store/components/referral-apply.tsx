"use client";

import { useState } from "react";
import { useReferralsApi } from "./_hooks";
import ReferralApplyTemplate from "./referral-apply.mdx";

export function ReferralApply() {
	const api = useReferralsApi();
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const applyMutation = api.apply.useMutation({
		onSuccess: (result: { error?: string }) => {
			if (result.error) {
				setError(result.error);
			} else {
				setSuccess(true);
				setCode("");
				setError("");
			}
		},
		onError: () => {
			setError("Failed to apply code. Please try again.");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccess(false);
		if (!code.trim()) return;
		applyMutation.mutate({ code: code.trim().toUpperCase() });
	};

	return (
		<ReferralApplyTemplate
			code={code}
			onCodeChange={setCode}
			onSubmit={handleSubmit}
			isLoading={applyMutation.isPending}
			error={error}
			success={success}
		/>
	);
}
