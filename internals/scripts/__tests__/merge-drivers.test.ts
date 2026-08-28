import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
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
let originalBranch = "";
const restoredFiles = new Map<string, string>();

afterEach(() => {
	for (const [path, contents] of restoredFiles.entries()) {
		writeFileSync(path, contents);
	}
	restoredFiles.clear();

	if (originalBranch) {
		run(`git checkout ${originalBranch}`, WORKSPACE_ROOT);
		originalBranch = "";
	}

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
		const branch = `test/merge-driver-config-${Date.now()}`;
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
		originalBranch = run(
			"git branch --show-current",
			WORKSPACE_ROOT,
		).stdout.trim();
		const stamp = Date.now();
		const mainBranch = `test/merge-driver-main-${stamp}`;
		const branchA = `test/merge-driver-a-${stamp}`;
		const branchB = `test/merge-driver-b-${stamp}`;
		branches.push(mainBranch, branchA, branchB);

		const searchIndexPath = join(
			WORKSPACE_ROOT,
			"modules/search/src/admin/components/search-analytics.tsx",
		);
		const productsIndexPath = join(
			WORKSPACE_ROOT,
			"modules/products/src/index.ts",
		);
		restoredFiles.set(searchIndexPath, readFileSync(searchIndexPath, "utf-8"));
		restoredFiles.set(
			productsIndexPath,
			readFileSync(productsIndexPath, "utf-8"),
		);

		expectSuccess(
			"sh internals/scripts/configure-git-merge-drivers.sh",
			WORKSPACE_ROOT,
		);
		expectSuccess(`git checkout -b ${mainBranch}`, WORKSPACE_ROOT);

		expectSuccess(`git checkout -b ${branchA}`, WORKSPACE_ROOT);
		writeFileSync(searchIndexPath, `${restoredFiles.get(searchIndexPath)}\n`);
		expectSuccess("bun run generate:modules", WORKSPACE_ROOT);
		expectSuccess(
			"git add apps/registry/registry.lock.json modules/search/src/admin/components/search-analytics.tsx",
			WORKSPACE_ROOT,
		);
		expectSuccess(
			'git commit -m "test(repo): branch a module change" --no-verify',
			WORKSPACE_ROOT,
		);

		expectSuccess(`git checkout ${mainBranch}`, WORKSPACE_ROOT);
		expectSuccess(`git checkout -b ${branchB}`, WORKSPACE_ROOT);
		writeFileSync(
			productsIndexPath,
			`${restoredFiles.get(productsIndexPath)}\n`,
		);
		expectSuccess("bun run generate:modules", WORKSPACE_ROOT);
		expectSuccess(
			"git add apps/registry/registry.lock.json modules/products/src/index.ts",
			WORKSPACE_ROOT,
		);
		expectSuccess(
			'git commit -m "test(repo): branch b module change" --no-verify',
			WORKSPACE_ROOT,
		);

		expectSuccess(`git checkout ${mainBranch}`, WORKSPACE_ROOT);
		expectSuccess(`git merge ${branchA}`, WORKSPACE_ROOT);
		const mergeResult = run(`git merge ${branchB}`, WORKSPACE_ROOT);
		expect(mergeResult.status, mergeResult.stderr).toBe(0);

		expectSuccess("bun run generate:modules", WORKSPACE_ROOT);
		expectSuccess("bun run generate:modules -- --frozen", WORKSPACE_ROOT);

		const lockRaw = readFileSync(
			join(WORKSPACE_ROOT, "apps/registry/registry.lock.json"),
			"utf-8",
		);
		const generatedAtIndex = lockRaw.indexOf('"generatedAt"');
		const modulesIndex = lockRaw.indexOf('"modules"');
		expect(generatedAtIndex).toBeGreaterThan(modulesIndex);
	}, 120_000);
});
