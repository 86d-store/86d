-- PostgreSQL initialization script for 86d Store (Docker)
-- Creates the nanoid() function used by schema defaults.
-- Neon provides this natively; standard Postgres needs it defined here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION nanoid(
    size INT DEFAULT 21,
    alphabet TEXT DEFAULT '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    idBuilder     TEXT  := '';
    i             INT   := 0;
    bytes         BYTEA;
    alphabetIndex INT;
    mask          INT;
    step          INT;
BEGIN
    mask := (2 << CAST(FLOOR(LOG(LENGTH(alphabet) - 1) / LOG(2)) AS INT)) - 1;
    step := CAST(CEIL(1.6 * mask * size / LENGTH(alphabet)) AS INT);

    WHILE TRUE LOOP
        bytes := gen_random_bytes(step);
        WHILE i < step LOOP
            alphabetIndex := (get_byte(bytes, i) & mask) + 1;
            IF alphabetIndex <= LENGTH(alphabet) THEN
                idBuilder := idBuilder || SUBSTR(alphabet, alphabetIndex, 1);
                IF LENGTH(idBuilder) = size THEN
                    RETURN idBuilder;
                END IF;
            END IF;
            i := i + 1;
        END LOOP;
        i := 0;
    END LOOP;
END
$$;
