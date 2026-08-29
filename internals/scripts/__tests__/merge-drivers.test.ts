import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");

const GIT_ENV =
	'GIT_AUTHOR_NAME="86d test" GIT_AUTHOR_EMAIL="test@86d.local" GIT_COMMITTER_NAME="86d test" GIT_COMMITTER_EMAIL="test@86d.local" GIT_MERGE_AUTOEDIT=no';

function run(
	command: string,
	cwd: string,
): { status: number | null; stdout: string; stderr: string } {
	const result = spawnSync(`${GIT_ENV} ${command}`, {
		cwd,
		shell: true,
		encoding: "utf-8",
	});
	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

function expectSuccess(command: string, cwd: string): void {
	const result = run(command, cwd);
	expect(result.status, `${command}\n${result.stderr}`).toBe(0);
}

function prepareWorktree(worktreePath: string): void {
	const nodeModulesPath = join(worktreePath, "node_modules");
	if (!existsSync(nodeModulesPath)) {
		symlinkSync(join(WORKSPACE_ROOT, "node_modules"), nodeModulesPath);
	}
	for (const workspaceGroup of ["apps", "internals", "modules", "packages"]) {
		const groupPath = join(WORKSPACE_ROOT, workspaceGroup);
		for (const entry of readdirSync(groupPath, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const source = join(groupPath, entry.name, "node_modules");
			if (!existsSync(source)) continue;
			const target = join(
				worktreePath,
				workspaceGroup,
				entry.name,
				"node_modules",
			);
			if (!existsSync(target)) {
				symlinkSync(source, target);
			}
		}
	}

	mkdirSync(join(worktreePath, "internals"), { recursive: true });
	run(
		`cp -R "${join(WORKSPACE_ROOT, "internals/scripts")}" "${join(worktreePath, "internals/")}"`,
		WORKSPACE_ROOT,
	);
	run(
		`cp "${join(WORKSPACE_ROOT, ".gitattributes")}" "${worktreePath}/.gitattributes"`,
		WORKSPACE_ROOT,
	);
}

const worktrees: string[] = [];
const branches: string[] = [];

afterEach(() => {
	for (const worktreePath of worktrees.splice(0)) {
		run(`git worktree remove "${worktreePath}" --force`, WORKSPACE_ROOT);
		rmSync(worktreePath, { recursive: true, force: true });
	}
	for (const branch of branches.splice(0)) {
		run(`git branch -D ${branch}`, WORKSPACE_ROOT);
	}
});

describe("lockfile merge drivers", () => {
	it("configures git merge drivers for registry and bun locks", () => {
		const worktreePath = mkdtempSync(
			join(tmpdir(), "86d-merge-driver-config-"),
		);
		const branch = `test/merge-driver-config-${process.pid}-${Date.now()}-${randomUUID().slice(0, 8)}`;
		worktrees.push(worktreePath);
		branches.push(branch);

		expectSuccess(
			`git worktree add -b ${branch} "${worktreePath}" HEAD`,
			WORKSPACE_ROOT,
		);
		prepareWorktree(worktreePath);
		expectSuccess(
			"sh internals/scripts/configure-git-merge-drivers.sh",
			worktreePath,
		);

		const registryDriver = run(
			"git config --get merge.registry-lock.driver",
			worktreePath,
		);
		const bunDriver = run(
			"git config --get merge.bun-lock.driver",
			worktreePath,
		);

		expect(registryDriver.stdout.trim()).toBe(
			"internals/scripts/merge-registry-lock.sh %A",
		);
		expect(bunDriver.stdout.trim()).toBe(
			"internals/scripts/merge-bun-lock.sh %A",
		);
	});

	it("resolves registry.lock.json merge conflicts by regenerating", () => {
		const callerState = {
			head: run("git rev-parse HEAD", WORKSPACE_ROOT).stdout,
			symbolicRef: run("git symbolic-ref -q HEAD", WORKSPACE_ROOT).stdout,
			status: run(
				"git status --porcelain=v1 --untracked-files=all",
				WORKSPACE_ROOT,
			).stdout,
		};
		const worktreePath = mkdtempSync(join(tmpdir(), "86d-merge-driver-"));
		const stamp = `${process.pid}-${Date.now()}-${randomUUID().slice(0, 8)}`;
		const mainBranch = `test/merge-driver-main-${stamp}`;
		const branchA = `test/merge-driver-a-${stamp}`;
		const branchB = `test/merge-driver-b-${stamp}`;
		worktrees.push(worktreePath);
		branches.push(mainBranch, branchA, branchB);
		expectSuccess(
			`git worktree add -b ${mainBranch} "${worktreePath}" HEAD`,
			WORKSPACE_ROOT,
		);
		prepareWorktree(worktreePath);

		const searchIndexPath = join(
			worktreePath,
			"modules/search/src/admin/components/search-analytics.tsx",
		);
		const productsIndexPath = join(
			worktreePath,
			"modules/products/src/index.ts",
		);
		const searchIndex = readFileSync(searchIndexPath, "utf-8");
		const productsIndex = readFileSync(productsIndexPath, "utf-8");

		expectSuccess(
			"sh internals/scripts/configure-git-merge-drivers.sh",
			worktreePath,
		);

		expectSuccess(`git checkout -b ${branchA}`, worktreePath);
		writeFileSync(searchIndexPath, `${searchIndex}\n`);
		expectSuccess("bun run generate:modules", worktreePath);
		expectSuccess(
			"git add apps/registry/registry.lock.json modules/search/src/admin/components/search-analytics.tsx",
			worktreePath,
		);
		expectSuccess(
			'git commit -m "test(repo): branch a module change" --no-verify',
			worktreePath,
		);

		expectSuccess(`git checkout ${mainBranch}`, worktreePath);
		expectSuccess(`git checkout -b ${branchB}`, worktreePath);
		writeFileSync(productsIndexPath, `${productsIndex}\n`);
		expectSuccess("bun run generate:modules", worktreePath);
		expectSuccess(
			"git add apps/registry/registry.lock.json modules/products/src/index.ts",
			worktreePath,
		);
		expectSuccess(
			'git commit -m "test(repo): branch b module change" --no-verify',
			worktreePath,
		);

		expectSuccess(`git checkout ${mainBranch}`, worktreePath);
		expectSuccess(`git merge ${branchA}`, worktreePath);
		const mergeResult = run(`git merge ${branchB}`, worktreePath);
		expect(mergeResult.status, mergeResult.stderr).toBe(0);

		expectSuccess("bun run generate:modules", worktreePath);
		expectSuccess("bun run generate:modules -- --frozen", worktreePath);

		const lockRaw = readFileSync(
			join(worktreePath, "apps/registry/registry.lock.json"),
			"utf-8",
		);
		const generatedAtIndex = lockRaw.indexOf('"generatedAt"');
		const modulesIndex = lockRaw.indexOf('"modules"');
		expect(generatedAtIndex).toBeGreaterThan(modulesIndex);
		expect({
			head: run("git rev-parse HEAD", WORKSPACE_ROOT).stdout,
			symbolicRef: run("git symbolic-ref -q HEAD", WORKSPACE_ROOT).stdout,
			status: run(
				"git status --porcelain=v1 --untracked-files=all",
				WORKSPACE_ROOT,
			).stdout,
		}).toEqual(callerState);
	}, 120_000);
});
