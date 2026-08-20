-- Subject overrun: sum(captured_minor) per subject cannot exceed expected_minor.
-- DEFERRABLE so authorize+capture in one transaction can stage rows before commit check.
CREATE OR REPLACE FUNCTION core.enforce_subject_capture_ceiling()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_captured integer;
  expected_minor_value integer;
BEGIN
  SELECT COALESCE(SUM(t."captured_minor"), 0), s."expected_minor"
  INTO total_captured, expected_minor_value
  FROM core.subject s
  LEFT JOIN core.transaction t ON t."subject_id" = s.id
  WHERE s.id = COALESCE(NEW."subject_id", OLD."subject_id")
  GROUP BY s."expected_minor";

  IF total_captured > expected_minor_value THEN
    RAISE EXCEPTION 'subject_overrun: captured % exceeds expected_minor % for subject %',
      total_captured, expected_minor_value, COALESCE(NEW."subject_id", OLD."subject_id")
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS transaction_subject_capture_ceiling ON core.transaction;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER transaction_subject_capture_ceiling
AFTER INSERT OR UPDATE OR DELETE ON core.transaction
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION core.enforce_subject_capture_ceiling();
