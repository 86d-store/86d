import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("template", () => {
	let tempDir: string;
	let logs: string[];

	beforeEach(() => {
		tempDir = join(tmpdir(), `86d-cli-template-test-${Date.now()}`);
		mkdirSync(join(tempDir, "templates/brisa"), { recursive: true });
		mkdirSync(join(tempDir, "apps/store"), { recursive: true });

		// Base template files
		writeFileSync(
			join(tempDir, "templates/brisa/config.json"),
			JSON.stringify(
				{
					theme: "brisa",
					name: "86d Brisa Theme",
					modules: ["@86d-app/products", "@86d-app/cart"],
				},
				null,
				"\t",
			),
		);
		writeFileSync(
			join(tempDir, "templates/brisa/global.css"),
			"/* brisa styles */",
		);

		// Store tsconfig with template path alias
		writeFileSync(
			join(tempDir, "apps/store/tsconfig.json"),
			JSON.stringify(
				{
					compilerOptions: {
						paths: {
							"template/*": ["../../templates/brisa/*"],
						},
					},
				},
				null,
				"\t",
			),
		);

		logs = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		});
		vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		});
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		vi.restoreAllMocks();
	});

	let mockFetchTemplate: ReturnType<typeof vi.fn>;

	async function runTemplate(
		subcommand: string,
		args: string[] = [],
		options?: {
			fetchResult?: {
				success: boolean;
				localPath?: string;
				error?: string;
				config?: Record<string, unknown>;
			};
		},
	) {
		vi.resetModules();
		vi.doMock("../utils.js", async () => {
			const actual =
				await vi.importActual<typeof import("../utils.js")>("../utils.js");
			return {
				...actual,
				findProjectRoot: () => tempDir,
			};
		});

		mockFetchTemplate = vi.fn();
		if (options?.fetchResult) {
			mockFetchTemplate.mockImplementation(() => {
				// Simulate what the real fetchTemplate does: create the directory
				if (options.fetchResult?.success && options.fetchResult.localPath) {
					mkdirSync(options.fetchResult.localPath, { recursive: true });
					if (options.fetchResult.config) {
						writeFileSync(
							join(options.fetchResult.localPath, "config.json"),
							`${JSON.stringify(options.fetchResult.config, null, "\t")}\n`,
						);
					}
				}
				return Promise.resolve(options.fetchResult);
			});
		}

		vi.doMock("@86d-app/registry/template", async () => {
			const actual = await vi.importActual<
				typeof import("@86d-app/registry/template")
			>("@86d-app/registry/template");
			return {
				...actual,
				fetchTemplate: mockFetchTemplate,
			};
		});

		const { templateCommand } = await import("../commands/template.js");
		return templateCommand(subcommand, args);
	}

	it("creates a new template by copying brisa", async () => {
		await runTemplate("create", ["minimal"]);

		const templateDir = join(tempDir, "templates/minimal");
		expect(existsSync(templateDir)).toBe(true);
		expect(existsSync(join(templateDir, "global.css"))).toBe(true);
	});

	it("updates config.json with new theme name", async () => {
		await runTemplate("create", ["dark"]);

		const config = JSON.parse(
			readFileSync(join(tempDir, "templates/dark/config.json"), "utf-8"),
		);
		expect(config.theme).toBe("dark");
		expect(config.name).toBe("86d Dark Theme");
	});

	it("preserves modules from base template", async () => {
		await runTemplate("create", ["minimal"]);

		const config = JSON.parse(
			readFileSync(join(tempDir, "templates/minimal/config.json"), "utf-8"),
		);
		expect(config.modules).toContain("@86d-app/products");
		expect(config.modules).toContain("@86d-app/cart");
	});

	it("lists templates with active indicator", async () => {
		await runTemplate("list");

		const output = logs.join("\n");
		expect(output).toContain("brisa");
		expect(output).toContain("(active)");
	});

	it("rejects duplicate template name", async () => {
		const exit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit");
		});

		await expect(runTemplate("create", ["brisa"])).rejects.toThrow("exit");
		expect(exit).toHaveBeenCalledWith(1);
	});

	describe("template activate", () => {
		it("activates a template by updating tsconfig path alias", async () => {
			// Create a second template
			mkdirSync(join(tempDir, "templates/minimal"), { recursive: true });
			writeFileSync(
				join(tempDir, "templates/minimal/config.json"),
				JSON.stringify({ theme: "minimal", name: "Minimal Theme" }),
			);

			await runTemplate("activate", ["minimal"]);

			const tsconfig = readFileSync(
				join(tempDir, "apps/store/tsconfig.json"),
				"utf-8",
			);
			expect(tsconfig).toContain("templates/minimal/");
			expect(tsconfig).not.toContain("templates/brisa/");
		});

		it("shows previous template name on activate", async () => {
			mkdirSync(join(tempDir, "templates/dark"), { recursive: true });
			writeFileSync(
				join(tempDir, "templates/dark/config.json"),
				JSON.stringify({ theme: "dark" }),
			);

			await runTemplate("activate", ["dark"]);

			const output = logs.join("\n");
			expect(output).toContain("was brisa");
		});

		it("warns when template is already active", async () => {
			await runTemplate("activate", ["brisa"]);

			const output = logs.join("\n");
			expect(output).toContain("already active");
		});

		it("rejects non-existent template", async () => {
			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(runTemplate("activate", ["nonexistent"])).rejects.toThrow(
				"exit",
			);
			expect(exit).toHaveBeenCalledWith(1);
		});

		it("rejects template without config.json", async () => {
			mkdirSync(join(tempDir, "templates/broken"), { recursive: true });

			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(runTemplate("activate", ["broken"])).rejects.toThrow("exit");
			expect(exit).toHaveBeenCalledWith(1);
		});

		it("rejects missing name argument", async () => {
			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(runTemplate("activate", [])).rejects.toThrow("exit");
			expect(exit).toHaveBeenCalledWith(1);
		});

		it("works with 'use' alias", async () => {
			mkdirSync(join(tempDir, "templates/alt"), { recursive: true });
			writeFileSync(
				join(tempDir, "templates/alt/config.json"),
				JSON.stringify({ theme: "alt" }),
			);

			await runTemplate("use", ["alt"]);

			const tsconfig = readFileSync(
				join(tempDir, "apps/store/tsconfig.json"),
				"utf-8",
			);
			expect(tsconfig).toContain("templates/alt/");
		});
	});

	describe("template add", () => {
		it("adds a template from a GitHub specifier", async () => {
			const targetDir = join(tempDir, "templates/my-theme");

			await runTemplate("add", ["github:owner/repo/templates/my-theme"], {
				fetchResult: {
					success: true,
					localPath: targetDir,
					config: {
						theme: "my-theme",
						modules: ["@86d-app/cart"],
					},
				},
			});

			const output = logs.join("\n");
			expect(output).toContain("Added template");
			expect(output).toContain("my-theme");
			expect(existsSync(join(targetDir, "config.json"))).toBe(true);
		});

		it("refuses to add a template that does not ship config.json", async () => {
			const targetDir = join(tempDir, "templates/repo");
			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(
				runTemplate("add", ["github:owner/repo"], {
					fetchResult: { success: true, localPath: targetDir },
				}),
			).rejects.toThrow("exit");
			expect(exit).toHaveBeenCalledWith(1);
			expect(existsSync(join(targetDir, "config.json"))).toBe(false);

			const output = logs.join("\n");
			expect(output).toMatch(/config\.json/);
			expect(output).toContain("templates/brisa/config.json");
			expect(output).not.toContain("created minimal config");
		});

		it("skips when template already exists locally", async () => {
			mkdirSync(join(tempDir, "templates/existing"), { recursive: true });
			writeFileSync(
				join(tempDir, "templates/existing/config.json"),
				JSON.stringify({ theme: "existing" }),
			);

			await runTemplate("add", ["github:owner/existing"], {
				fetchResult: { success: true, localPath: "" },
			});

			const output = logs.join("\n");
			expect(output).toContain("already exists locally");
			expect(mockFetchTemplate).not.toHaveBeenCalled();
		});

		it("reports error when fetch fails", async () => {
			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(
				runTemplate("add", ["github:owner/bad-repo"], {
					fetchResult: { success: false, error: "404 Not Found" },
				}),
			).rejects.toThrow("exit");
			expect(exit).toHaveBeenCalledWith(1);
		});

		it("exits with error when no specifier provided", async () => {
			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(runTemplate("add", [])).rejects.toThrow("exit");
			expect(exit).toHaveBeenCalledWith(1);
		});

		it("works with 'install' alias", async () => {
			const targetDir = join(tempDir, "templates/alias-theme");

			await runTemplate(
				"install",
				["github:owner/repo/templates/alias-theme"],
				{
					fetchResult: {
						success: true,
						localPath: targetDir,
						config: {
							theme: "alias-theme",
							modules: ["@86d-app/cart"],
						},
					},
				},
			);

			const output = logs.join("\n");
			expect(output).toContain("Added template");
		});
	});

	describe("template remove", () => {
		it("removes an installed template", async () => {
			mkdirSync(join(tempDir, "templates/custom"), { recursive: true });
			writeFileSync(
				join(tempDir, "templates/custom/config.json"),
				JSON.stringify({ theme: "custom" }),
			);

			await runTemplate("remove", ["custom"]);

			expect(existsSync(join(tempDir, "templates/custom"))).toBe(false);
			const output = logs.join("\n");
			expect(output).toContain("Removed template");
		});

		it("prevents removing the base template", async () => {
			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(runTemplate("remove", ["brisa"])).rejects.toThrow("exit");
			expect(exit).toHaveBeenCalledWith(1);
			expect(existsSync(join(tempDir, "templates/brisa"))).toBe(true);
		});

		it("prevents removing the active template", async () => {
			// brisa is active (from tsconfig). Create and try to remove
			// a template that we first activate.
			mkdirSync(join(tempDir, "templates/active-one"), { recursive: true });
			writeFileSync(
				join(tempDir, "templates/active-one/config.json"),
				JSON.stringify({ theme: "active-one" }),
			);

			// Activate it by updating tsconfig
			const tsconfigPath = join(tempDir, "apps/store/tsconfig.json");
			const tsconfig = readFileSync(tsconfigPath, "utf-8");
			writeFileSync(
				tsconfigPath,
				tsconfig.replace("templates/brisa/", "templates/active-one/"),
			);

			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(runTemplate("remove", ["active-one"])).rejects.toThrow(
				"exit",
			);
			expect(exit).toHaveBeenCalledWith(1);
			expect(existsSync(join(tempDir, "templates/active-one"))).toBe(true);
		});

		it("reports error when template does not exist", async () => {
			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(runTemplate("remove", ["nonexistent"])).rejects.toThrow(
				"exit",
			);
			expect(exit).toHaveBeenCalledWith(1);
		});

		it("exits with error when no name provided", async () => {
			const exit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("exit");
			});

			await expect(runTemplate("remove", [])).rejects.toThrow("exit");
			expect(exit).toHaveBeenCalledWith(1);
		});

		it("works with 'rm' alias", async () => {
			mkdirSync(join(tempDir, "templates/removable"), { recursive: true });
			writeFileSync(
				join(tempDir, "templates/removable/config.json"),
				JSON.stringify({ theme: "removable" }),
			);

			await runTemplate("rm", ["removable"]);

			expect(existsSync(join(tempDir, "templates/removable"))).toBe(false);
		});
	});
});
