CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION nanoid(
  size int DEFAULT 21,
  alphabet text DEFAULT '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
) RETURNS text LANGUAGE plpgsql VOLATILE AS $func$
DECLARE
  id text := '';
  i int := 0;
  bytes bytea;
  idx int;
  mask int;
  step int;
BEGIN
  mask := (2 << cast(floor(log(length(alphabet) - 1) / log(2)) as int)) - 1;
  step := cast(ceil(1.6 * mask * size / length(alphabet)) as int);
  LOOP
    bytes := gen_random_bytes(step);
    WHILE i < step LOOP
      idx := (get_byte(bytes, i) & mask) + 1;
      IF idx <= length(alphabet) THEN
        id := id || substr(alphabet, idx, 1);
        IF length(id) = size THEN RETURN id; END IF;
      END IF;
      i := i + 1;
    END LOOP;
    i := 0;
  END LOOP;
END
$func$;
