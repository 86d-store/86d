"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import LoyaltyRulesTemplate from "./loyalty-rules.mdx";

interface LoyaltyRule {
	id: string;
	name: string;
	type: "per_dollar" | "fixed_bonus" | "multiplier" | "signup";
	points: number;
	minOrderAmount?: number | null;
	active: boolean;
	createdAt: string;
}

type RuleType = LoyaltyRule["type"];

const RULE_TYPE_LABELS: Record<RuleType, string> = {
	per_dollar: "Per Dollar",
	fixed_bonus: "Fixed Bonus",
	multiplier: "Multiplier",
	signup: "Sign-up Bonus",
};

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function useLoyaltyRulesApi() {
	const client = useModuleClient();
	const admin = client.module("loyalty").admin;
	return {
		listRules: admin["/admin/loyalty/rules"],
		createRule: admin["/admin/loyalty/rules/create"],
		updateRule: admin["/admin/loyalty/rules/:id/update"],
		deleteRule: admin["/admin/loyalty/rules/:id/delete"],
	};
}

export function LoyaltyRules() {
	const api = useLoyaltyRulesApi();
	const [error, setError] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [editingRule, setEditingRule] = useState<LoyaltyRule | null>(null);
	const [formName, setFormName] = useState("");
	const [formType, setFormType] = useState<RuleType>("per_dollar");
	const [formPoints, setFormPoints] = useState("");
	const [formMinOrder, setFormMinOrder] = useState("");
	const [actionLoading, setActionLoading] = useState(false);

	const {
		data: rulesData,
		isLoading: loading,
		error: queryError,
	} = api.listRules.useQuery({}) as {
		data: { rules: LoyaltyRule[] } | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	const rules = rulesData?.rules ?? [];

	const createMutation = api.createRule.useMutation({
		onSuccess: () => resetForm(),
		onError: (err: Error) =>
			setError(extractError(err, "Failed to create rule.")),
		onSettled: () => {
			setActionLoading(false);
			void api.listRules.invalidate();
		},
	});

	const updateMutation = api.updateRule.useMutation({
		onSuccess: () => resetForm(),
		onError: (err: Error) =>
			setError(extractError(err, "Failed to update rule.")),
		onSettled: () => {
			setActionLoading(false);
			void api.listRules.invalidate();
		},
	});

	const deleteMutation = api.deleteRule.useMutation({
		onError: (err: Error) =>
			setError(extractError(err, "Failed to delete rule.")),
		onSettled: () => {
			setActionLoading(false);
			void api.listRules.invalidate();
		},
	});

	function resetForm() {
		setShowForm(false);
		setEditingRule(null);
		setFormName("");
		setFormType("per_dollar");
		setFormPoints("");
		setFormMinOrder("");
		setError("");
	}

	function startEdit(rule: LoyaltyRule) {
		setEditingRule(rule);
		setFormName(rule.name);
		setFormType(rule.type);
		setFormPoints(String(rule.points));
		setFormMinOrder(
			rule.minOrderAmount != null ? String(rule.minOrderAmount) : "",
		);
		setShowForm(true);
		setError("");
	}

	function handleSubmit() {
		const points = Number(formPoints);
		if (!formName.trim()) {
			setError("Name is required.");
			return;
		}
		if (Number.isNaN(points) || points < 0) {
			setError("Points must be a non-negative number.");
			return;
		}

		setActionLoading(true);
		setError("");

		const minOrderAmount = formMinOrder.trim()
			? Number(formMinOrder)
			: undefined;

		if (editingRule) {
			updateMutation.mutate({
				params: { id: editingRule.id },
				body: {
					name: formName.trim(),
					points,
					...(minOrderAmount !== undefined ? { minOrderAmount } : {}),
				},
			});
		} else {
			createMutation.mutate({
				body: {
					name: formName.trim(),
					type: formType,
					points,
					...(minOrderAmount !== undefined ? { minOrderAmount } : {}),
				},
			});
		}
	}

	function handleToggleActive(rule: LoyaltyRule) {
		setActionLoading(true);
		setError("");
		updateMutation.mutate({
			params: { id: rule.id },
			body: { active: !rule.active },
		});
	}

	function handleDelete(rule: LoyaltyRule) {
		setActionLoading(true);
		setError("");
		deleteMutation.mutate({ params: { id: rule.id } });
	}

	const ruleRows =
		loading && rules.length === 0 ? (
			Array.from({ length: 5 }, (_, i) => (
				<tr key={`sk-${i}`}>
					{Array.from({ length: 6 }, (_, j) => (
						<td key={`sk-cell-${j}`} className="px-4 py-3">
							<Skeleton className="h-4" />
						</td>
					))}
				</tr>
			))
		) : queryError ? (
			<tr>
				<td colSpan={6} className="px-4 py-8 text-center text-destructive">
					Failed to load rules.
				</td>
			</tr>
		) : rules.length === 0 ? (
			<tr>
				<td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
					No earn rules configured yet. Create one to get started.
				</td>
			</tr>
		) : (
			rules.map((rule) => (
				<tr
					key={rule.id}
					className="border-border border-b last:border-0 hover:bg-muted/20"
				>
					<td className="px-4 py-3 font-medium text-foreground">{rule.name}</td>
					<td className="px-4 py-3">
						<span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{RULE_TYPE_LABELS[rule.type]}
						</span>
					</td>
					<td className="px-4 py-3 text-foreground">
						{new Intl.NumberFormat("en-US").format(rule.points)}
					</td>
					<td className="px-4 py-3 text-muted-foreground">
						{rule.minOrderAmount != null
							? `$${rule.minOrderAmount.toFixed(2)}`
							: "\u2014"}
					</td>
					<td className="px-4 py-3">
						<button
							type="button"
							onClick={() => handleToggleActive(rule)}
							disabled={actionLoading}
							className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${
								rule.active
									? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
									: "bg-muted/30 text-muted-foreground"
							}`}
						>
							{rule.active ? "Active" : "Inactive"}
						</button>
					</td>
					<td className="px-4 py-3 text-right">
						<div className="flex justify-end gap-1">
							<button
								type="button"
								onClick={() => startEdit(rule)}
								className="rounded px-2 py-1 font-medium text-foreground text-xs hover:bg-muted"
							>
								Edit
							</button>
							<button
								type="button"
								disabled={actionLoading}
								onClick={() => handleDelete(rule)}
								className="rounded px-2 py-1 font-medium text-red-600 text-xs hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
							>
								Delete
							</button>
						</div>
					</td>
				</tr>
			))
		);

	const formSection = showForm ? (
		<div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
			<h4 className="font-medium text-foreground text-sm">
				{editingRule ? "Edit Rule" : "New Earn Rule"}
			</h4>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Name
					</span>
					<input
						type="text"
						value={formName}
						onChange={(e) => setFormName(e.target.value)}
						placeholder="e.g. Base earn rate"
						maxLength={200}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</label>
				{!editingRule && (
					<label className="block">
						<span className="mb-1 block font-medium text-foreground text-sm">
							Type
						</span>
						<select
							value={formType}
							onChange={(e) => setFormType(e.target.value as RuleType)}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						>
							{(Object.entries(RULE_TYPE_LABELS) as [RuleType, string][]).map(
								([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								),
							)}
						</select>
					</label>
				)}
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Points
					</span>
					<input
						type="number"
						min="0"
						step="1"
						value={formPoints}
						onChange={(e) => setFormPoints(e.target.value)}
						placeholder="e.g. 1"
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Min Order ($)
					</span>
					<input
						type="number"
						min="0"
						step="0.01"
						value={formMinOrder}
						onChange={(e) => setFormMinOrder(e.target.value)}
						placeholder="Optional"
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</label>
			</div>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={actionLoading}
					onClick={handleSubmit}
					className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					{actionLoading
						? "Saving..."
						: editingRule
							? "Update Rule"
							: "Create Rule"}
				</button>
				<button
					type="button"
					onClick={resetForm}
					className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</div>
	) : null;

	return (
		<LoyaltyRulesTemplate
			error={error}
			showForm={showForm}
			onShowForm={() => {
				resetForm();
				setShowForm(true);
			}}
			formSection={formSection}
			ruleRows={ruleRows}
		/>
	);
}
