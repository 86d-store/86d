BEGIN;

-- Grant binding enforcement (functions, checks, triggers). Table columns live in 0000_baseline.
LOCK TABLE "CommandExecution", "Approval", "Confirmation", "ChangeSet", "StandingPermission", "StandingPermissionUseReservation" IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION "command_target_reference_is_valid"(value JSONB) RETURNS BOOLEAN AS $$
BEGIN
    IF jsonb_typeof(value) IS DISTINCT FROM 'object'
        OR NOT (value ?& ARRAY['type', 'id'])
    THEN
        RETURN FALSE;
    END IF;
    RETURN COALESCE(
        value - ARRAY['type', 'id'] = '{}'::jsonb
        AND jsonb_typeof(value->'type') IS NOT DISTINCT FROM 'string'
        AND value->>'type' IN ('account', 'business', 'store', 'connection', 'resource', 'workflow')
        AND jsonb_typeof(value->'id') IS NOT DISTINCT FROM 'string'
        AND length(value->>'id') BETWEEN 1 AND 255,
        FALSE
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

CREATE FUNCTION "command_target_reference_matches"(
    value JSONB,
    target_type TEXT,
    target_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        "command_target_reference_is_valid"(value) IS TRUE
        AND value->>'type' IS NOT DISTINCT FROM target_type
        AND value->>'id' IS NOT DISTINCT FROM target_id,
        FALSE
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

CREATE FUNCTION "command_actor_reference_matches"(
    value JSONB,
    actor_type TEXT,
    actor_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    IF jsonb_typeof(value) IS DISTINCT FROM 'object'
        OR NOT (value ?& ARRAY['type', 'id'])
    THEN
        RETURN FALSE;
    END IF;
    RETURN COALESCE(
        value - ARRAY['type', 'id'] = '{}'::jsonb
        AND jsonb_typeof(value->'type') IS NOT DISTINCT FROM 'string'
        AND value->>'type' IN ('account', 'workload', 'system')
        AND value->>'type' IS NOT DISTINCT FROM actor_type
        AND jsonb_typeof(value->'id') IS NOT DISTINCT FROM 'string'
        AND value->>'id' IS NOT DISTINCT FROM actor_id
        AND length(value->>'id') BETWEEN 1 AND 255,
        FALSE
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

CREATE FUNCTION "command_string_array_is_bounded"(
    value JSONB,
    minimum_items INTEGER,
    maximum_items INTEGER,
    maximum_length INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    item JSONB;
BEGIN
    IF jsonb_typeof(value) IS DISTINCT FROM 'array'
        OR jsonb_array_length(value) < minimum_items
        OR jsonb_array_length(value) > maximum_items
    THEN
        RETURN FALSE;
    END IF;
    FOR item IN SELECT element FROM jsonb_array_elements(value) AS entries(element)
    LOOP
        IF jsonb_typeof(item) IS DISTINCT FROM 'string'
            OR length(item #>> '{}') < 1
            OR length(item #>> '{}') > maximum_length
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

CREATE FUNCTION "command_authority_snapshot_matches"(
    value JSONB,
    authority_type TEXT,
    authority_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    IF jsonb_typeof(value) IS DISTINCT FROM 'object'
        OR NOT (value ?& ARRAY['id', 'type', 'permissions'])
        OR value - ARRAY['id', 'type', 'role', 'permissions', 'businessId', 'storeId'] <> '{}'::jsonb
        OR jsonb_typeof(value->'id') IS DISTINCT FROM 'string'
        OR value->>'id' IS DISTINCT FROM authority_id
        OR length(value->>'id') NOT BETWEEN 1 AND 255
        OR jsonb_typeof(value->'type') IS DISTINCT FROM 'string'
        OR value->>'type' IS DISTINCT FROM authority_type
        OR value->>'type' NOT IN (
            'account_owner',
            'business_membership',
            'store_membership',
            'custom_role',
            'standing_permission',
            'workload_grant',
            'system_grant'
        )
        OR "command_string_array_is_bounded"(value->'permissions', 0, 250, 200) IS NOT TRUE
    THEN
        RETURN FALSE;
    END IF;
    IF value ? 'role' AND (
        jsonb_typeof(value->'role') IS DISTINCT FROM 'string'
        OR length(value->>'role') NOT BETWEEN 1 AND 100
    ) THEN
        RETURN FALSE;
    END IF;
    IF value ? 'businessId' AND (
        jsonb_typeof(value->'businessId') IS DISTINCT FROM 'string'
        OR length(value->>'businessId') NOT BETWEEN 1 AND 255
    ) THEN
        RETURN FALSE;
    END IF;
    IF value ? 'storeId' AND (
        jsonb_typeof(value->'storeId') IS DISTINCT FROM 'string'
        OR length(value->>'storeId') NOT BETWEEN 1 AND 255
    ) THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

CREATE FUNCTION "change_set_base_revisions_are_valid"(value JSONB) RETURNS BOOLEAN AS $$
DECLARE
    item JSONB;
    target_key TEXT;
    seen_targets TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF jsonb_typeof(value) IS DISTINCT FROM 'array'
        OR jsonb_array_length(value) NOT BETWEEN 1 AND 250
    THEN
        RETURN FALSE;
    END IF;
    FOR item IN SELECT element FROM jsonb_array_elements(value) AS entries(element)
    LOOP
        IF jsonb_typeof(item) IS DISTINCT FROM 'object'
            OR NOT (item ?& ARRAY['target', 'revision'])
            OR item - ARRAY['target', 'revision'] <> '{}'::jsonb
            OR "command_target_reference_is_valid"(item->'target') IS NOT TRUE
            OR jsonb_typeof(item->'revision') IS DISTINCT FROM 'string'
            OR length(item->>'revision') NOT BETWEEN 1 AND 255
        THEN
            RETURN FALSE;
        END IF;
        target_key := (item->'target')::TEXT;
        IF target_key = ANY(seen_targets) THEN
            RETURN FALSE;
        END IF;
        seen_targets := array_append(seen_targets, target_key);
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

CREATE FUNCTION "change_set_targets_are_valid"(
    value JSONB,
    owner_target JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    item JSONB;
    target_key TEXT;
    seen_targets TEXT[] := ARRAY[]::TEXT[];
    includes_owner BOOLEAN := FALSE;
BEGIN
    IF jsonb_typeof(value) IS DISTINCT FROM 'array'
        OR jsonb_array_length(value) NOT BETWEEN 1 AND 250
    THEN
        RETURN FALSE;
    END IF;
    FOR item IN SELECT element FROM jsonb_array_elements(value) AS entries(element)
    LOOP
        IF "command_target_reference_is_valid"(item) IS NOT TRUE THEN
            RETURN FALSE;
        END IF;
        target_key := item::TEXT;
        IF target_key = ANY(seen_targets) THEN
            RETURN FALSE;
        END IF;
        seen_targets := array_append(seen_targets, target_key);
        includes_owner := includes_owner OR item = owner_target;
    END LOOP;
    RETURN includes_owner IS TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

CREATE FUNCTION "change_set_estimated_charges_are_valid"(value JSONB) RETURNS BOOLEAN AS $$
DECLARE
    item JSONB;
BEGIN
    IF jsonb_typeof(value) IS DISTINCT FROM 'array' OR jsonb_array_length(value) > 250 THEN
        RETURN FALSE;
    END IF;
    FOR item IN SELECT element FROM jsonb_array_elements(value) AS entries(element)
    LOOP
        IF jsonb_typeof(item) IS DISTINCT FROM 'object'
            OR NOT (item ?& ARRAY['amount', 'currency', 'description'])
            OR item - ARRAY['amount', 'currency', 'description'] <> '{}'::jsonb
            OR jsonb_typeof(item->'amount') IS DISTINCT FROM 'string'
            OR item->>'amount' !~ '^(0|[1-9][0-9]*)$'
            OR jsonb_typeof(item->'currency') IS DISTINCT FROM 'string'
            OR item->>'currency' !~ '^[A-Z]{3}$'
            OR jsonb_typeof(item->'description') IS DISTINCT FROM 'string'
            OR length(item->>'description') NOT BETWEEN 1 AND 500
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

CREATE FUNCTION "change_set_proposal_matches"(
    value JSONB,
    target_type TEXT,
    target_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    command_value JSONB;
    target_value JSONB;
BEGIN
    IF jsonb_typeof(value) IS DISTINCT FROM 'object'
        OR NOT (value ?& ARRAY['command', 'target', 'inputDigest'])
        OR value - ARRAY['command', 'target', 'inputDigest', 'opaqueDraftReference'] <> '{}'::jsonb
    THEN
        RETURN FALSE;
    END IF;
    command_value := value->'command';
    target_value := value->'target';
    IF jsonb_typeof(command_value) IS DISTINCT FROM 'object'
        OR NOT (command_value ?& ARRAY['name', 'version'])
        OR command_value - ARRAY['name', 'version'] <> '{}'::jsonb
        OR jsonb_typeof(command_value->'name') IS DISTINCT FROM 'string'
        OR command_value->>'name' !~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
        OR length(command_value->>'name') NOT BETWEEN 3 AND 200
        OR jsonb_typeof(command_value->'version') IS DISTINCT FROM 'number'
        OR command_value->>'version' !~ '^[1-9][0-9]*$'
        OR "command_target_reference_matches"(target_value, target_type, target_id) IS NOT TRUE
        OR jsonb_typeof(value->'inputDigest') IS DISTINCT FROM 'string'
        OR value->>'inputDigest' !~ '^[a-f0-9]{64}$'
    THEN
        RETURN FALSE;
    END IF;
    IF value ? 'opaqueDraftReference' AND (
        jsonb_typeof(value->'opaqueDraftReference') IS DISTINCT FROM 'string'
        OR length(value->>'opaqueDraftReference') NOT BETWEEN 1 AND 255
    ) THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

ALTER TABLE "CommandExecution"
    ADD CONSTRAINT "CommandExecution_requestDigestVersion_check"
        CHECK ("requestDigestVersion" IN (1, 2)),
    ADD CONSTRAINT "CommandExecution_commandBinding_pair_check"
        CHECK (("commandBindingHashVersion" IS NULL) = ("commandBindingHash" IS NULL)),
    ADD CONSTRAINT "CommandExecution_commandBindingVersion_check"
        CHECK ("commandBindingHashVersion" IS NULL OR "commandBindingHashVersion" = 1),
    ADD CONSTRAINT "CommandExecution_commandBindingHash_check"
        CHECK ("commandBindingHash" IS NULL OR "commandBindingHash" ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT "CommandExecution_actor_json_check"
        CHECK ("command_actor_reference_matches"("actor", "actorType", "actorId")),
    ADD CONSTRAINT "CommandExecution_authority_json_check"
        CHECK ("command_authority_snapshot_matches"("authority", "authorityType", "authorityId")),
    ADD CONSTRAINT "CommandExecution_target_json_check"
        CHECK ("command_target_reference_matches"("target", "targetType", "targetId"));

ALTER TABLE "ChangeSet"
    ADD CONSTRAINT "ChangeSet_changeSetHashVersion_check"
        CHECK ("changeSetHashVersion" = 1),
    ADD CONSTRAINT "ChangeSet_target_json_check"
        CHECK ("command_target_reference_matches"("target", "targetType", "targetId")),
    ADD CONSTRAINT "ChangeSet_proposal_check"
        CHECK ("change_set_proposal_matches"("proposal", "targetType", "targetId")),
    ADD CONSTRAINT "ChangeSet_baseRevisions_check"
        CHECK ("change_set_base_revisions_are_valid"("baseRevisions")),
    ADD CONSTRAINT "ChangeSet_affectedTargets_check"
        CHECK ("change_set_targets_are_valid"("affectedTargets", "target")),
    ADD CONSTRAINT "ChangeSet_publicEffects_check"
        CHECK ("command_string_array_is_bounded"("publicEffects", 0, 250, 500)),
    ADD CONSTRAINT "ChangeSet_operationalEffects_check"
        CHECK ("command_string_array_is_bounded"("operationalEffects", 0, 250, 500)),
    ADD CONSTRAINT "ChangeSet_estimatedCharges_check"
        CHECK ("change_set_estimated_charges_are_valid"("estimatedCharges")),
    ADD CONSTRAINT "ChangeSet_requiredPermissions_check"
        CHECK ("command_string_array_is_bounded"("requiredPermissions", 0, 250, 200)),
    ADD CONSTRAINT "ChangeSet_validationBlocks_check"
        CHECK ("command_string_array_is_bounded"("validationBlocks", 0, 250, 500)),
    ADD CONSTRAINT "ChangeSet_immutable_status_check"
        CHECK (
            ("status" = 'draft' AND "immutableAt" IS NULL)
            OR "status" IN ('conflicted', 'failed')
            OR ("status" IN ('approved', 'applied') AND "immutableAt" IS NOT NULL)
        ),
    ADD CONSTRAINT "ChangeSet_lineage_check"
        CHECK ("supersedesChangeSetId" IS NULL OR "supersedesChangeSetId" <> "id");

ALTER TABLE "Approval"
    ADD CONSTRAINT "Approval_actor_json_check"
        CHECK ("command_actor_reference_matches"("actor", "actorType", "actorId")),
    ADD CONSTRAINT "Approval_human_actor_check"
        CHECK ("actorType" = 'account'),
    ADD CONSTRAINT "Approval_authority_json_check"
        CHECK ("command_authority_snapshot_matches"("authority", "authorityType", "authorityId")),
    ADD CONSTRAINT "Approval_baseRevisions_check"
        CHECK ("change_set_base_revisions_are_valid"("baseRevisions")),
    ADD CONSTRAINT "Approval_invalidation_time_check"
        CHECK ("invalidatedAt" IS NULL OR "invalidatedAt" >= "approvedAt");

ALTER TABLE "Confirmation"
    ADD CONSTRAINT "Confirmation_sessionId_check"
        CHECK (length("sessionId") BETWEEN 1 AND 255),
    ADD CONSTRAINT "Confirmation_actor_json_check"
        CHECK ("command_actor_reference_matches"("actor", "actorType", "actorId")),
    ADD CONSTRAINT "Confirmation_human_actor_check"
        CHECK ("actorType" = 'account'),
    ADD CONSTRAINT "Confirmation_target_json_check"
        CHECK ("command_target_reference_matches"("target", "targetType", "targetId")),
    ADD CONSTRAINT "Confirmation_commandName_check"
        CHECK ("commandName" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
    ADD CONSTRAINT "Confirmation_commandVersion_check"
        CHECK ("commandVersion" > 0),
    ADD CONSTRAINT "Confirmation_bindingHashVersion_check"
        CHECK ("bindingHashVersion" = 1),
    ADD CONSTRAINT "Confirmation_consumption_time_check"
        CHECK (
            "consumedAt" IS NULL
            OR ("consumedAt" >= "createdAt" AND "consumedAt" < "expiresAt")
        );

ALTER TABLE "StandingPermission"
    DROP CONSTRAINT IF EXISTS "StandingPermission_currency_required_check",
    ADD CONSTRAINT "StandingPermission_grantee_json_check"
        CHECK ("command_actor_reference_matches"("grantee", "granteeType", "granteeId")),
    ADD CONSTRAINT "StandingPermission_grantor_json_check"
        CHECK ("command_actor_reference_matches"("grantor", "grantorType", "grantorId")),
    ADD CONSTRAINT "StandingPermission_authority_json_check"
        CHECK ("command_authority_snapshot_matches"("authority", "authorityType", "authorityId")),
    ADD CONSTRAINT "StandingPermission_authority_business_check"
        CHECK (NOT ("authority" ? 'businessId') OR "authority"->>'businessId' = "businessId"),
    ADD CONSTRAINT "StandingPermission_authority_store_check"
        CHECK (
            "storeId" IS NULL
            OR NOT ("authority" ? 'storeId')
            OR "authority"->>'storeId' = "storeId"
        ),
    ADD CONSTRAINT "StandingPermission_financial_scope_check"
        CHECK (
            ("perOperationAmount" IS NULL AND "aggregateAmount" IS NULL AND "currency" IS NULL)
            OR (
                "perOperationAmount" IS NOT NULL
                AND "aggregateAmount" IS NOT NULL
                AND "currency" IS NOT NULL
                AND "perOperationAmount" >= 0
                AND "aggregateAmount" >= "perOperationAmount"
            )
        ),
    ADD CONSTRAINT "StandingPermission_actionName_check"
        CHECK ("actionName" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
    ADD CONSTRAINT "StandingPermission_revocation_time_check"
        CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

-- Existing M1A checks only required a currency when either financial field was
-- present. The M1C tuple check above is the complete, stricter invariant.
ALTER TABLE "StandingPermission"
    DROP CONSTRAINT IF EXISTS "StandingPermission_perOperationAmount_check",
    DROP CONSTRAINT IF EXISTS "StandingPermission_aggregateAmount_check";

ALTER TABLE "StandingPermissionUseReservation"
    ADD CONSTRAINT "StandingPermissionUseReservation_amount_currency_check"
        CHECK (("amount" IS NULL) = ("currency" IS NULL)),
    ADD CONSTRAINT "StandingPermissionUseReservation_time_check"
        CHECK ("updatedAt" >= "createdAt");

-- An approval freezes the exact reviewed proposal. The trigger rejects the
-- NEW.immutableAt bypass: a caller cannot change review fields while making a
-- previously mutable row immutable in the same UPDATE.
CREATE FUNCTION "enforce_change_set_immutability"() RETURNS trigger AS $$
DECLARE
    has_exact_approval BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."status" <> 'draft' OR NEW."immutableAt" IS NOT NULL THEN
            RAISE EXCEPTION 'A ChangeSet must be created as a mutable draft';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD."immutableAt" IS NOT NULL
            OR EXISTS (SELECT 1 FROM "Approval" WHERE "changeSetId" = OLD."id")
        THEN
            RAISE EXCEPTION 'An approved ChangeSet is immutable';
        END IF;
        RETURN OLD;
    END IF;

    IF NOT (
        NEW."status" = OLD."status"
        OR (OLD."status" = 'draft' AND NEW."status" IN ('approved', 'conflicted', 'failed'))
        OR (OLD."status" = 'approved' AND NEW."status" IN ('applied', 'conflicted', 'failed'))
    ) THEN
        RAISE EXCEPTION 'Invalid ChangeSet state transition from % to %', OLD."status", NEW."status";
    END IF;

    IF OLD."immutableAt" IS NOT NULL OR NEW."immutableAt" IS NOT NULL THEN
        IF NEW."id" IS DISTINCT FROM OLD."id"
            OR NEW."version" IS DISTINCT FROM OLD."version"
            OR NEW."changeSetHashVersion" IS DISTINCT FROM OLD."changeSetHashVersion"
            OR NEW."ownerPlane" IS DISTINCT FROM OLD."ownerPlane"
            OR NEW."reviewHash" IS DISTINCT FROM OLD."reviewHash"
            OR NEW."targetType" IS DISTINCT FROM OLD."targetType"
            OR NEW."targetId" IS DISTINCT FROM OLD."targetId"
            OR NEW."target" IS DISTINCT FROM OLD."target"
            OR NEW."proposal" IS DISTINCT FROM OLD."proposal"
            OR NEW."supersedesChangeSetId" IS DISTINCT FROM OLD."supersedesChangeSetId"
            OR NEW."baseRevisions" IS DISTINCT FROM OLD."baseRevisions"
            OR NEW."affectedTargets" IS DISTINCT FROM OLD."affectedTargets"
            OR NEW."beforeSummary" IS DISTINCT FROM OLD."beforeSummary"
            OR NEW."afterSummary" IS DISTINCT FROM OLD."afterSummary"
            OR NEW."publicEffects" IS DISTINCT FROM OLD."publicEffects"
            OR NEW."operationalEffects" IS DISTINCT FROM OLD."operationalEffects"
            OR NEW."estimatedCharges" IS DISTINCT FROM OLD."estimatedCharges"
            OR NEW."requiredPermissions" IS DISTINCT FROM OLD."requiredPermissions"
            OR NEW."validationBlocks" IS DISTINCT FROM OLD."validationBlocks"
            OR NEW."rollbackCoverage" IS DISTINCT FROM OLD."rollbackCoverage"
            OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
        THEN
            RAISE EXCEPTION 'An approved ChangeSet review binding is immutable';
        END IF;
    END IF;

    IF OLD."immutableAt" IS NULL AND NEW."immutableAt" IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM "Approval"
            WHERE "changeSetId" = NEW."id"
                AND "reviewHash" = NEW."reviewHash"
                AND "baseRevisions" = NEW."baseRevisions"
                AND "invalidatedAt" IS NULL
        ) INTO has_exact_approval;
        IF NEW."status" <> 'approved'
            OR NOT has_exact_approval
            OR current_setting('app86d.approving_change_set', TRUE) NOT LIKE NEW."id" || ':%'
        THEN
            RAISE EXCEPTION 'A ChangeSet becomes immutable only through an exact Approval';
        END IF;
    END IF;

    IF OLD."immutableAt" IS NOT NULL
        AND NEW."immutableAt" IS DISTINCT FROM OLD."immutableAt"
    THEN
        RAISE EXCEPTION 'A ChangeSet immutable timestamp cannot change';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ChangeSet_enforce_immutability"
    BEFORE INSERT OR UPDATE OR DELETE ON "ChangeSet"
    FOR EACH ROW EXECUTE FUNCTION "enforce_change_set_immutability"();

CREATE FUNCTION "enforce_change_set_lineage"() RETURNS trigger AS $$
DECLARE
    parent "ChangeSet"%ROWTYPE;
    creates_cycle BOOLEAN;
BEGIN
    IF NEW."supersedesChangeSetId" IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT * INTO parent
    FROM "ChangeSet"
    WHERE "id" = NEW."supersedesChangeSetId"
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    IF parent."ownerPlane" <> NEW."ownerPlane"
        OR parent."target" <> NEW."target"
    THEN
        RAISE EXCEPTION 'ChangeSet lineage cannot cross plane or owning target';
    END IF;
    IF parent."reviewHash" = NEW."reviewHash" THEN
        RAISE EXCEPTION 'A regenerated or rebased ChangeSet requires a new review hash';
    END IF;
    WITH RECURSIVE ancestors("id", "supersedesChangeSetId") AS (
        SELECT lineage."id", lineage."supersedesChangeSetId"
        FROM "ChangeSet" lineage
        WHERE lineage."id" = NEW."supersedesChangeSetId"
        UNION ALL
        SELECT lineage."id", lineage."supersedesChangeSetId"
        FROM "ChangeSet" lineage
        JOIN ancestors ON lineage."id" = ancestors."supersedesChangeSetId"
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE "id" = NEW."id")
    INTO creates_cycle;
    IF creates_cycle THEN
        RAISE EXCEPTION 'ChangeSet lineage cannot contain a cycle';
    END IF;

    IF parent."status" NOT IN ('draft', 'approved', 'conflicted') THEN
        RAISE EXCEPTION 'A finalized ChangeSet cannot be superseded';
    END IF;
    UPDATE "Approval" SET "invalidatedAt" = CURRENT_TIMESTAMP
    WHERE "changeSetId" = parent."id" AND "invalidatedAt" IS NULL;
    UPDATE "ChangeSet" SET "status" = 'conflicted', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = parent."id" AND "status" IN ('draft', 'approved');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ChangeSet_enforce_lineage"
    BEFORE INSERT OR UPDATE OF "supersedesChangeSetId", "ownerPlane", "target", "reviewHash" ON "ChangeSet"
    FOR EACH ROW EXECUTE FUNCTION "enforce_change_set_lineage"();

CREATE FUNCTION "enforce_approval_binding"() RETURNS trigger AS $$
DECLARE
    reviewed "ChangeSet"%ROWTYPE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'An Approval is immutable';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW."id" IS DISTINCT FROM OLD."id"
            OR NEW."changeSetId" IS DISTINCT FROM OLD."changeSetId"
            OR NEW."reviewHash" IS DISTINCT FROM OLD."reviewHash"
            OR NEW."baseRevisions" IS DISTINCT FROM OLD."baseRevisions"
            OR NEW."actorType" IS DISTINCT FROM OLD."actorType"
            OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
            OR NEW."actor" IS DISTINCT FROM OLD."actor"
            OR NEW."authorityType" IS DISTINCT FROM OLD."authorityType"
            OR NEW."authorityId" IS DISTINCT FROM OLD."authorityId"
            OR NEW."authority" IS DISTINCT FROM OLD."authority"
            OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
            OR (OLD."invalidatedAt" IS NOT NULL AND NEW."invalidatedAt" IS DISTINCT FROM OLD."invalidatedAt")
            OR (
                OLD."invalidatedAt" IS NULL
                AND NEW."invalidatedAt" IS NOT NULL
                AND NEW."invalidatedAt" < NEW."approvedAt"
            )
        THEN
            RAISE EXCEPTION 'An Approval binding is immutable';
        END IF;
        IF OLD."invalidatedAt" IS NULL
            AND NEW."invalidatedAt" IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM "CommandExecution" WHERE "approvalId" = OLD."id"
            )
        THEN
            RAISE EXCEPTION 'A consumed Approval cannot be invalidated';
        END IF;
        RETURN NEW;
    END IF;

    SELECT * INTO reviewed
    FROM "ChangeSet"
    WHERE "id" = NEW."changeSetId"
    FOR UPDATE;
    IF NOT FOUND
        OR reviewed."status" NOT IN ('draft', 'approved')
        OR reviewed."reviewHash" <> NEW."reviewHash"
        OR reviewed."baseRevisions" <> NEW."baseRevisions"
        OR NOT (NEW."authority"->'permissions' @> reviewed."requiredPermissions")
        OR NEW."approvedAt" < reviewed."createdAt"
    THEN
        RAISE EXCEPTION 'Approval must bind the exact current ChangeSet review';
    END IF;
    IF NEW."invalidatedAt" IS NOT NULL THEN
        RAISE EXCEPTION 'A new Approval cannot already be invalidated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Approval_enforce_binding"
    BEFORE INSERT OR UPDATE OR DELETE ON "Approval"
    FOR EACH ROW EXECUTE FUNCTION "enforce_approval_binding"();

-- A same-transaction guard consumed by the ChangeSet trigger ensures setting
-- immutableAt is possible only as the direct consequence of this Approval.
CREATE FUNCTION "open_change_set_approval_guard"() RETURNS trigger AS $$
BEGIN
    PERFORM set_config(
        'app86d.approving_change_set',
        NEW."changeSetId" || ':' || NEW."id",
        TRUE
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Approval_open_change_set_guard"
    BEFORE INSERT ON "Approval"
    FOR EACH ROW EXECUTE FUNCTION "open_change_set_approval_guard"();

CREATE FUNCTION "approve_exact_change_set"() RETURNS trigger AS $$
BEGIN
    UPDATE "ChangeSet"
    SET "status" = 'approved',
        "immutableAt" = NEW."approvedAt",
        "updatedAt" = GREATEST("updatedAt", NEW."approvedAt")
    WHERE "id" = NEW."changeSetId" AND "status" = 'draft';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'The ChangeSet could not be atomically approved';
    END IF;
    PERFORM set_config('app86d.approving_change_set', '', TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Approval_mark_change_set_immutable"
    AFTER INSERT ON "Approval"
    FOR EACH ROW EXECUTE FUNCTION "approve_exact_change_set"();

CREATE FUNCTION "enforce_confirmation_one_time_use"() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'A Confirmation is immutable';
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW."consumedAt" IS NOT NULL THEN
            RAISE EXCEPTION 'A Confirmation must be created unused';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW."id" IS DISTINCT FROM OLD."id"
        OR NEW."actorType" IS DISTINCT FROM OLD."actorType"
        OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
        OR NEW."actor" IS DISTINCT FROM OLD."actor"
        OR NEW."sessionId" IS DISTINCT FROM OLD."sessionId"
        OR NEW."targetType" IS DISTINCT FROM OLD."targetType"
        OR NEW."targetId" IS DISTINCT FROM OLD."targetId"
        OR NEW."target" IS DISTINCT FROM OLD."target"
        OR NEW."commandName" IS DISTINCT FROM OLD."commandName"
        OR NEW."commandVersion" IS DISTINCT FROM OLD."commandVersion"
        OR NEW."bindingHashVersion" IS DISTINCT FROM OLD."bindingHashVersion"
        OR NEW."bindingHash" IS DISTINCT FROM OLD."bindingHash"
        OR NEW."nonceDigest" IS DISTINCT FROM OLD."nonceDigest"
        OR NEW."disclosure" IS DISTINCT FROM OLD."disclosure"
        OR NEW."amount" IS DISTINCT FROM OLD."amount"
        OR NEW."currency" IS DISTINCT FROM OLD."currency"
        OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
        OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
        OR (OLD."consumedAt" IS NOT NULL AND NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt")
    THEN
        RAISE EXCEPTION 'A Confirmation binding is immutable and can be consumed once';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Confirmation_enforce_one_time_use"
    BEFORE INSERT OR UPDATE OR DELETE ON "Confirmation"
    FOR EACH ROW EXECUTE FUNCTION "enforce_confirmation_one_time_use"();

CREATE FUNCTION "validate_confirmation_consumption"() RETURNS trigger AS $$
DECLARE
    confirmation_row "Confirmation"%ROWTYPE;
BEGIN
    SELECT * INTO confirmation_row FROM "Confirmation" WHERE "id" = NEW."id";
    IF FOUND AND confirmation_row."consumedAt" IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM "CommandExecution"
        WHERE "confirmationId" = confirmation_row."id"
            AND "grantUse"->>'kind' = 'confirmation'
            AND "grantUse"->>'confirmationId' = confirmation_row."id"
    ) THEN
        RAISE EXCEPTION 'A consumed Confirmation must belong to exactly one Command execution';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Confirmation_validate_consumption"
    AFTER INSERT OR UPDATE ON "Confirmation"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "validate_confirmation_consumption"();

CREATE FUNCTION "enforce_standing_permission_immutability"() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'A StandingPermission is immutable';
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW."revokedAt" IS NOT NULL THEN
            RAISE EXCEPTION 'A StandingPermission must be created active';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW."id" IS DISTINCT FROM OLD."id"
        OR NEW."granteeType" IS DISTINCT FROM OLD."granteeType"
        OR NEW."granteeId" IS DISTINCT FROM OLD."granteeId"
        OR NEW."grantee" IS DISTINCT FROM OLD."grantee"
        OR NEW."grantorType" IS DISTINCT FROM OLD."grantorType"
        OR NEW."grantorId" IS DISTINCT FROM OLD."grantorId"
        OR NEW."grantor" IS DISTINCT FROM OLD."grantor"
        OR NEW."authorityType" IS DISTINCT FROM OLD."authorityType"
        OR NEW."authorityId" IS DISTINCT FROM OLD."authorityId"
        OR NEW."authority" IS DISTINCT FROM OLD."authority"
        OR NEW."businessId" IS DISTINCT FROM OLD."businessId"
        OR NEW."storeId" IS DISTINCT FROM OLD."storeId"
        OR NEW."actionName" IS DISTINCT FROM OLD."actionName"
        OR NEW."actionVersion" IS DISTINCT FROM OLD."actionVersion"
        OR NEW."validFrom" IS DISTINCT FROM OLD."validFrom"
        OR NEW."validUntil" IS DISTINCT FROM OLD."validUntil"
        OR NEW."perOperationAmount" IS DISTINCT FROM OLD."perOperationAmount"
        OR NEW."aggregateAmount" IS DISTINCT FROM OLD."aggregateAmount"
        OR NEW."currency" IS DISTINCT FROM OLD."currency"
        OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
        OR (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt")
    THEN
        RAISE EXCEPTION 'A StandingPermission scope is immutable and can be revoked once';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StandingPermission_enforce_immutability"
    BEFORE INSERT OR UPDATE OR DELETE ON "StandingPermission"
    FOR EACH ROW EXECUTE FUNCTION "enforce_standing_permission_immutability"();

-- Locking the parent permission serializes cap accounting. Reserved,
-- committed, and ambiguous uses all hold aggregate authority; only a definite
-- release returns capacity.
CREATE FUNCTION "enforce_standing_reservation"() RETURNS trigger AS $$
DECLARE
    permission_row "StandingPermission"%ROWTYPE;
    execution_row "CommandExecution"%ROWTYPE;
    held_amount NUMERIC(65, 0);
    execution_store_id TEXT;
    decision_time TIMESTAMP(3);
BEGIN
    SELECT * INTO permission_row
    FROM "StandingPermission"
    WHERE "id" = CASE
        WHEN TG_OP = 'DELETE' THEN OLD."standingPermissionId"
        ELSE NEW."standingPermissionId"
    END
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'StandingPermission reservation has no permission';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'A StandingPermission reservation is immutable history';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW."id" IS DISTINCT FROM OLD."id"
            OR NEW."standingPermissionId" IS DISTINCT FROM OLD."standingPermissionId"
            OR NEW."commandExecutionId" IS DISTINCT FROM OLD."commandExecutionId"
            OR NEW."amount" IS DISTINCT FROM OLD."amount"
            OR NEW."currency" IS DISTINCT FROM OLD."currency"
            OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
            OR NOT (
                NEW."state" = OLD."state"
                OR (OLD."state" = 'reserved' AND NEW."state" IN ('committed', 'released', 'ambiguous'))
                OR (OLD."state" = 'ambiguous' AND NEW."state" IN ('committed', 'released'))
            )
        THEN
            RAISE EXCEPTION 'Invalid StandingPermission reservation transition from % to %', OLD."state", NEW."state";
        END IF;
        RETURN NEW;
    END IF;

    IF NEW."state" <> 'reserved' THEN
        RAISE EXCEPTION 'A StandingPermission reservation must begin reserved';
    END IF;
    SELECT * INTO execution_row
    FROM "CommandExecution"
    WHERE "id" = NEW."commandExecutionId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'StandingPermission reservation has no Command execution';
    END IF;
    decision_time := clock_timestamp()::timestamp(3);
    IF permission_row."revokedAt" IS NOT NULL
        OR decision_time < permission_row."validFrom"
        OR decision_time >= permission_row."validUntil"
        OR permission_row."grantee" <> execution_row."actor"
        OR permission_row."actionName" <> execution_row."commandName"
        OR permission_row."actionVersion" <> execution_row."commandVersion"
        OR execution_row."authority"->>'businessId' IS DISTINCT FROM permission_row."businessId"
    THEN
        RAISE EXCEPTION 'StandingPermission does not cover this Command execution';
    END IF;
    IF execution_row."targetType" = 'business' THEN
        IF execution_row."targetId" <> permission_row."businessId"
            OR permission_row."storeId" IS NOT NULL
        THEN
            RAISE EXCEPTION 'A Business Command requires a Business-global StandingPermission';
        END IF;
    ELSIF execution_row."targetType" = 'store' THEN
        IF execution_row."targetId" IS DISTINCT FROM execution_row."authority"->>'storeId'
            OR (
                permission_row."storeId" IS NOT NULL
                AND permission_row."storeId" <> execution_row."targetId"
            )
        THEN
            RAISE EXCEPTION 'StandingPermission does not cover this Store target';
        END IF;
    ELSE
        execution_store_id := execution_row."authority"->>'storeId';
        IF permission_row."storeId" IS DISTINCT FROM execution_store_id THEN
            RAISE EXCEPTION 'StandingPermission scope does not match this resource target';
        END IF;
    END IF;

    IF permission_row."perOperationAmount" IS NULL THEN
        IF NEW."amount" IS NOT NULL OR NEW."currency" IS NOT NULL THEN
            RAISE EXCEPTION 'A non-financial StandingPermission cannot reserve money';
        END IF;
    ELSE
        IF NEW."amount" IS NULL
            OR NEW."currency" IS DISTINCT FROM permission_row."currency"
            OR NEW."amount" > permission_row."perOperationAmount"
        THEN
            RAISE EXCEPTION 'StandingPermission per-operation financial scope exceeded';
        END IF;
        SELECT COALESCE(SUM("amount"), 0) INTO held_amount
        FROM "StandingPermissionUseReservation"
        WHERE "standingPermissionId" = permission_row."id"
            AND "state" IN ('reserved', 'committed', 'ambiguous');
        IF held_amount + NEW."amount" > permission_row."aggregateAmount" THEN
            RAISE EXCEPTION 'StandingPermission aggregate financial scope exceeded';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StandingPermissionUseReservation_enforce"
    BEFORE INSERT OR UPDATE OR DELETE ON "StandingPermissionUseReservation"
    FOR EACH ROW EXECUTE FUNCTION "enforce_standing_reservation"();

CREATE FUNCTION "enforce_command_grant_immutability"() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'A CommandExecution is immutable history';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW."id" IS DISTINCT FROM OLD."id"
            OR NEW."plane" IS DISTINCT FROM OLD."plane"
            OR NEW."commandName" IS DISTINCT FROM OLD."commandName"
            OR NEW."commandVersion" IS DISTINCT FROM OLD."commandVersion"
            OR NEW."actionLevel" IS DISTINCT FROM OLD."actionLevel"
            OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
            OR NEW."requestDigestVersion" IS DISTINCT FROM OLD."requestDigestVersion"
            OR NEW."inputDigest" IS DISTINCT FROM OLD."inputDigest"
            OR NEW."redactedInput" IS DISTINCT FROM OLD."redactedInput"
            OR NEW."actorType" IS DISTINCT FROM OLD."actorType"
            OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
            OR NEW."actor" IS DISTINCT FROM OLD."actor"
            OR NEW."authorityType" IS DISTINCT FROM OLD."authorityType"
            OR NEW."authorityId" IS DISTINCT FROM OLD."authorityId"
            OR NEW."authority" IS DISTINCT FROM OLD."authority"
            OR NEW."targetType" IS DISTINCT FROM OLD."targetType"
            OR NEW."targetId" IS DISTINCT FROM OLD."targetId"
            OR NEW."target" IS DISTINCT FROM OLD."target"
            OR (OLD."grantUse" IS NOT NULL AND (
                NEW."grantUse" IS DISTINCT FROM OLD."grantUse"
                OR NEW."approvalId" IS DISTINCT FROM OLD."approvalId"
                OR NEW."confirmationId" IS DISTINCT FROM OLD."confirmationId"
                OR NEW."commandBindingHashVersion" IS DISTINCT FROM OLD."commandBindingHashVersion"
                OR NEW."commandBindingHash" IS DISTINCT FROM OLD."commandBindingHash"
            ))
        THEN
            RAISE EXCEPTION 'A Command identity and admitted GrantUse are immutable';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CommandExecution_enforce_grant_immutability"
    BEFORE UPDATE OR DELETE ON "CommandExecution"
    FOR EACH ROW EXECUTE FUNCTION "enforce_command_grant_immutability"();

-- This constraint trigger deliberately reads the final row at transaction end.
-- Persistence may insert a provisional CommandExecution, atomically consume or
-- reserve its grant, and then install the normalized GrantUse before commit.
CREATE FUNCTION "validate_command_grant_use"() RETURNS trigger AS $$
DECLARE
    execution_id TEXT;
    execution_row "CommandExecution"%ROWTYPE;
    approval_row "Approval"%ROWTYPE;
    change_set_row "ChangeSet"%ROWTYPE;
    confirmation_row "Confirmation"%ROWTYPE;
    reservation_row "StandingPermissionUseReservation"%ROWTYPE;
    permission_row "StandingPermission"%ROWTYPE;
    grant_kind TEXT;
    expected_grant JSONB;
    reservation_count INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'StandingPermissionUseReservation' THEN
        execution_id := NEW."commandExecutionId";
    ELSE
        execution_id := NEW."id";
    END IF;
    SELECT * INTO execution_row FROM "CommandExecution" WHERE "id" = execution_id;
    IF NOT FOUND THEN
        IF TG_TABLE_NAME = 'StandingPermissionUseReservation' THEN
            RAISE EXCEPTION 'A StandingPermission reservation requires its Command execution';
        END IF;
        RETURN NEW;
    END IF;
    IF jsonb_typeof(execution_row."grantUse") <> 'object'
        OR jsonb_typeof(execution_row."grantUse"->'kind') <> 'string'
    THEN
        RAISE EXCEPTION 'A committed Command execution requires one normalized GrantUse';
    END IF;
    IF execution_row."requestDigestVersion" >= 2 AND (
        execution_row."commandBindingHashVersion" IS NULL
        OR execution_row."commandBindingHash" IS NULL
    ) THEN
        RAISE EXCEPTION 'A v2 Command request requires a versioned binding hash';
    END IF;
    grant_kind := execution_row."grantUse"->>'kind';
    IF grant_kind <> 'automatic' AND (
        execution_row."commandBindingHashVersion" IS NULL
        OR execution_row."commandBindingHash" IS NULL
    ) THEN
        RAISE EXCEPTION 'A non-automatic GrantUse requires a versioned Command binding hash';
    END IF;
    SELECT COUNT(*) INTO reservation_count
    FROM "StandingPermissionUseReservation"
    WHERE "commandExecutionId" = execution_row."id";

    IF grant_kind = 'automatic' THEN
        IF execution_row."grantUse" <> '{"kind":"automatic"}'::jsonb
            OR execution_row."actionLevel" <> 'automatic'
            OR execution_row."approvalId" IS NOT NULL
            OR execution_row."confirmationId" IS NOT NULL
            OR reservation_count <> 0
        THEN
            RAISE EXCEPTION 'Automatic Command grant references are inconsistent';
        END IF;
        RETURN NEW;
    END IF;

    IF grant_kind = 'approval' THEN
        IF execution_row."actionLevel" <> 'approve'
            OR execution_row."approvalId" IS NULL
            OR execution_row."confirmationId" IS NOT NULL
            OR reservation_count <> 0
        THEN
            RAISE EXCEPTION 'Approval Command grant references are inconsistent';
        END IF;
        SELECT * INTO approval_row FROM "Approval" WHERE "id" = execution_row."approvalId";
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Approval GrantUse has no Approval';
        END IF;
        SELECT * INTO change_set_row FROM "ChangeSet" WHERE "id" = approval_row."changeSetId";
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Approval GrantUse has no ChangeSet';
        END IF;
        expected_grant := jsonb_build_object(
            'kind', 'approval',
            'approvalId', approval_row."id",
            'changeSetId', change_set_row."id",
            'reviewHash', approval_row."reviewHash"::TEXT
        );
        IF execution_row."grantUse" <> expected_grant
            OR approval_row."reviewHash" <> change_set_row."reviewHash"
            OR approval_row."baseRevisions" <> change_set_row."baseRevisions"
            OR approval_row."invalidatedAt" IS NOT NULL
            OR approval_row."actor" <> execution_row."actor"
            OR approval_row."authority" <> execution_row."authority"
            OR change_set_row."ownerPlane" <> execution_row."plane"
            OR change_set_row."immutableAt" IS NULL
            OR (
                execution_row."status" IN ('pending', 'running')
                AND change_set_row."status" <> 'approved'
            )
            OR (
                execution_row."status" = 'succeeded'
                AND change_set_row."status" <> 'applied'
            )
            OR (
                execution_row."status" = 'failed'
                AND change_set_row."status" <> 'failed'
            )
            OR change_set_row."proposal"->'command' <> jsonb_build_object(
                'name', execution_row."commandName",
                'version', execution_row."commandVersion"
            )
            OR change_set_row."proposal"->'target' <> execution_row."target"
            OR change_set_row."proposal"->>'inputDigest' <> execution_row."inputDigest"
        THEN
            RAISE EXCEPTION 'Approval does not bind the exact Command proposal';
        END IF;
        RETURN NEW;
    END IF;

    IF grant_kind = 'confirmation' THEN
        IF execution_row."actionLevel" <> 'confirm_now'
            OR execution_row."approvalId" IS NOT NULL
            OR execution_row."confirmationId" IS NULL
            OR reservation_count <> 0
        THEN
            RAISE EXCEPTION 'Confirmation Command grant references are inconsistent';
        END IF;
        SELECT * INTO confirmation_row
        FROM "Confirmation"
        WHERE "id" = execution_row."confirmationId";
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Confirmation GrantUse has no Confirmation';
        END IF;
        expected_grant := jsonb_build_object(
            'kind', 'confirmation',
            'confirmationId', confirmation_row."id",
            'bindingHash', confirmation_row."bindingHash"::TEXT
        );
        IF execution_row."grantUse" <> expected_grant
            OR confirmation_row."actor" <> execution_row."actor"
            OR confirmation_row."target" <> execution_row."target"
            OR confirmation_row."commandName" <> execution_row."commandName"
            OR confirmation_row."commandVersion" <> execution_row."commandVersion"
            OR confirmation_row."bindingHashVersion" <> execution_row."commandBindingHashVersion"
            OR confirmation_row."bindingHash" <> execution_row."commandBindingHash"
            OR confirmation_row."consumedAt" IS NULL
        THEN
            RAISE EXCEPTION 'Confirmation does not bind the exact Command execution';
        END IF;
        RETURN NEW;
    END IF;

    IF grant_kind = 'standing_permission' THEN
        IF execution_row."actionLevel" <> 'confirm_now'
            OR execution_row."approvalId" IS NOT NULL
            OR execution_row."confirmationId" IS NOT NULL
            OR reservation_count <> 1
        THEN
            RAISE EXCEPTION 'StandingPermission Command grant references are inconsistent';
        END IF;
        SELECT * INTO reservation_row
        FROM "StandingPermissionUseReservation"
        WHERE "commandExecutionId" = execution_row."id";
        SELECT * INTO permission_row
        FROM "StandingPermission"
        WHERE "id" = reservation_row."standingPermissionId";
        IF reservation_row."amount" IS NULL THEN
            expected_grant := jsonb_build_object(
                'kind', 'standing_permission',
                'standingPermissionId', permission_row."id",
                'reservationId', reservation_row."id"
            );
        ELSE
            expected_grant := jsonb_build_object(
                'kind', 'standing_permission',
                'standingPermissionId', permission_row."id",
                'reservationId', reservation_row."id",
                'amount', reservation_row."amount"::TEXT,
                'currency', reservation_row."currency"::TEXT
            );
        END IF;
        IF execution_row."grantUse" <> expected_grant
            OR permission_row."grantee" <> execution_row."actor"
            OR permission_row."actionName" <> execution_row."commandName"
            OR permission_row."actionVersion" <> execution_row."commandVersion"
            OR (execution_row."status" = 'pending' AND reservation_row."state" <> 'reserved')
            OR (execution_row."status" = 'running' AND reservation_row."state" NOT IN ('reserved', 'ambiguous'))
            OR (execution_row."status" = 'succeeded' AND reservation_row."state" <> 'committed')
            OR (execution_row."status" = 'failed' AND reservation_row."state" <> 'released')
        THEN
            RAISE EXCEPTION 'StandingPermission GrantUse does not match its reservation';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Unknown normalized GrantUse kind: %', grant_kind;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "CommandExecution_validate_grant_use"
    AFTER INSERT OR UPDATE ON "CommandExecution"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "validate_command_grant_use"();

CREATE CONSTRAINT TRIGGER "StandingPermissionUseReservation_validate_grant_use"
    AFTER INSERT OR UPDATE ON "StandingPermissionUseReservation"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "validate_command_grant_use"();

COMMIT;
