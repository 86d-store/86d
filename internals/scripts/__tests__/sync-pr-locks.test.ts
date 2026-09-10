import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actionSource = readFileSync(
	resolve(import.meta.dirname, "../../github/sync-pr-locks/action.yml"),
	"utf8",
);
const workflowSource = readFileSync(
	resolve(import.meta.dirname, "../../../.github/workflows/sync-pr-locks.yml"),
	"utf8",
);

describe("sync PR lockfiles action", () => {
	it("never mutates forks and reports manual synchronization", () => {
		const skipCondition = "if: steps.fork_gate.outputs.skip == 'true'";
		const blockStart = actionSource.indexOf(skipCondition);
		const blockEnd = actionSource.indexOf("\n    - name:", blockStart);
		const guardedMutatingSteps = [
			"Configure git merge drivers",
			"Rebase and regenerate lockfiles",
			"Comment when non-lock conflicts remain",
			"Push rebased branch",
		];

		expect(blockStart).toBeGreaterThan(-1);
		expect(blockEnd).toBeGreaterThan(blockStart);

		const skippedForkBlock = actionSource.slice(blockStart, blockEnd);
		expect(actionSource).toContain(
			'if [ "$HEAD_REPO" != "$REPOSITORY" ]; then',
		);
		for (const stepName of guardedMutatingSteps) {
			const stepStart = actionSource.indexOf(`- name: ${stepName}`);
			const stepEnd = actionSource.indexOf("\n    - name:", stepStart);
			const stepBlock = actionSource.slice(
				stepStart,
				stepEnd === -1 ? undefined : stepEnd,
			);

			expect(stepStart).toBeGreaterThan(-1);
			expect(stepBlock).toContain("if: steps.fork_gate.outputs.skip != 'true'");
		}
		expect(skippedForkBlock).toContain("GITHUB_STEP_SUMMARY");
		expect(skippedForkBlock).not.toContain("gh pr comment");
		expect(
			skippedForkBlock.indexOf("configure-git-merge-drivers.sh"),
		).toBeLessThan(skippedForkBlock.indexOf("git rebase FETCH_HEAD"));
		expect(actionSource).not.toContain("REPO_SYNC_TOKEN");
		expect(workflowSource).not.toContain("REPO_SYNC_TOKEN");
	});
});
