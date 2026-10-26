BEGIN;

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS driver_phone varchar(20);
DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'app_user' AND column_name = 'is_driver'
    ) THEN
        ALTER TABLE app_user ADD COLUMN is_driver boolean NOT NULL DEFAULT false;
        UPDATE app_user AS u
        SET is_driver = true, driver_phone = u.phone
        WHERE u.is_deleted = 0 AND u.status = 1 AND u.register_channel <> 5
            AND u.phone ~ '^1[3-9][0-9]{9}$'
            AND EXISTS (
                SELECT 1 FROM rickshaw_vehicle AS v
                WHERE v.driver_user_id = u.id AND v.driver_phone = u.phone
                    AND v.status = 1 AND v.is_deleted = 0
            );
    END IF;
END
$migration$;

ALTER TABLE translation_room ALTER COLUMN rickshaw_id DROP NOT NULL;
DROP INDEX IF EXISTS ux_translation_room_active_vehicle;
CREATE UNIQUE INDEX IF NOT EXISTS ux_translation_room_active_host
    ON translation_room(host_user_id)
    WHERE status <> 'closed' AND is_deleted = 0 AND rickshaw_id IS NULL;

ALTER TABLE chat_session DROP CONSTRAINT IF EXISTS ck_chat_session_scene;
ALTER TABLE chat_session ADD CONSTRAINT ck_chat_session_scene
    CHECK (scene IN ('authoring', 'exhibit_qa', 'platform', 'room_translation')) NOT VALID;
ALTER TABLE chat_session VALIDATE CONSTRAINT ck_chat_session_scene;

COMMIT;
