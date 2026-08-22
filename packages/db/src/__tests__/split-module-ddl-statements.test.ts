import { describe, expect, it } from "vitest";
import { splitModuleDdlStatements } from "../schema/apply-disposable-ddl";

describe("splitModuleDdlStatements", () => {
	it("keeps CREATE ROLE DO blocks after isolation comment markers", () => {
		const sql = `
-- Store isolation bootstrap
DO $$ BEGIN CREATE ROLE "store_owner"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE "store_login" NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE ALL ON SCHEMA public FROM "store_login";

-- Isolation: products
DO $$ BEGIN CREATE ROLE "mod_products" NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER ROLE "mod_products" SET statement_timeout = 5000;
GRANT "mod_products" TO "store_login";
`;
		const statements = splitModuleDdlStatements(sql);
		expect(
			statements.filter((statement) => statement.includes("CREATE ROLE")),
		).toHaveLength(3);
		expect(
			statements.some((statement) => statement.includes('"mod_products"')),
		).toBe(true);
		expect(
			statements.some((statement) =>
				statement.includes('ALTER ROLE "mod_products"'),
			),
		).toBe(true);
	});

	it("keeps SECURITY DEFINER function bodies with internal semicolons", () => {
		const sql = `
CREATE OR REPLACE FUNCTION core.cfg_cart_get(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  allowed text[] := ARRAY['guest_ttl_days'];
BEGIN
  IF NOT (p_key = ANY (allowed)) THEN
    RAISE EXCEPTION 'config key not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION core.cfg_cart_get(text) TO "mod_cart";
`;
		const statements = splitModuleDdlStatements(sql);
		expect(statements).toHaveLength(2);
		expect(statements[0]).toContain("cfg_cart_get");
		expect(statements[0]).toContain("ARRAY['guest_ttl_days']");
		expect(statements[1]).toContain("GRANT EXECUTE");
	});
});
