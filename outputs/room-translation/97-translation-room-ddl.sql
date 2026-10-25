BEGIN;

ALTER TABLE rickshaw_vehicle ADD COLUMN IF NOT EXISTS driver_phone varchar(20);
ALTER TABLE rickshaw_vehicle ADD COLUMN IF NOT EXISTS driver_user_no varchar(64);
ALTER TABLE rickshaw_vehicle ADD COLUMN IF NOT EXISTS driver_user_id bigint REFERENCES app_user(id);
CREATE INDEX IF NOT EXISTS ix_rickshaw_driver_user ON rickshaw_vehicle(driver_user_id)
    WHERE is_deleted = 0 AND driver_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS translation_room (
    id bigint PRIMARY KEY,
    rickshaw_id bigint NOT NULL REFERENCES rickshaw_vehicle(id),
    host_user_id bigint NOT NULL REFERENCES app_user(id),
    join_code varchar(8) NOT NULL,
    source_language varchar(10) NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'live', 'paused', 'draining', 'closed')),
    expires_at timestamptz NOT NULL,
    closed_reason varchar(64),
    is_deleted smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_translation_room_active_vehicle ON translation_room(rickshaw_id)
    WHERE status <> 'closed' AND is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS ux_translation_room_active_code ON translation_room(join_code)
    WHERE status <> 'closed' AND is_deleted = 0;
CREATE INDEX IF NOT EXISTS ix_translation_room_host ON translation_room(host_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS translation_room_segment (
    id bigint PRIMARY KEY,
    room_id bigint NOT NULL REFERENCES translation_room(id),
    epoch_id bigint NOT NULL,
    sequence integer NOT NULL CHECK (sequence > 0),
    language varchar(10) NOT NULL,
    text text NOT NULL,
    is_deleted smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_translation_room_segment_order
    ON translation_room_segment(room_id, epoch_id, sequence, language);

COMMENT ON COLUMN rickshaw_vehicle.driver_phone IS '后台确认的车夫手机号，必须匹配授权账号';
COMMENT ON COLUMN rickshaw_vehicle.driver_user_id IS '保存手机号时绑定当前已有账号，后续注册不能自动继承房主权限';
COMMENT ON TABLE translation_room IS '单实例实时讲解房间；进程重启后显式关闭未完成房间';
COMMENT ON TABLE translation_room_segment IS '已提交原文及各语言完整译文，不保存游客凭证或音频';

COMMIT;
