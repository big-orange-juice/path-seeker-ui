-- 电子明信片、节点生成配置及段间音乐/视频。
-- 数据库：PostgreSQL。与本轮已执行的建表脚本结构一致。
-- 依赖已有表：route_stage、app_user、puzzle_route、user_route_visit。
-- 本文件仅包含 DDL；基础模板数据见 94-electronic-postcards-seeds.sql。

BEGIN;

-- 明信片模板。
CREATE TABLE IF NOT EXISTS postcard_template (
    id          bigint PRIMARY KEY,
    name        varchar(80) NOT NULL,
    mode        varchar(8) NOT NULL CHECK (mode IN ('html', 'ai')),
    html        text NOT NULL,
    prompt      text NOT NULL DEFAULT '',
    width       integer NOT NULL DEFAULT 1080,
    height      integer NOT NULL DEFAULT 1440,
    enabled     boolean NOT NULL DEFAULT true,
    version     integer NOT NULL DEFAULT 1,
    is_deleted  smallint NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 节点生成开关、模板集合及段间媒体配置。
CREATE TABLE IF NOT EXISTS node_experience (
    id                  bigint PRIMARY KEY,
    stage_id            bigint NOT NULL REFERENCES route_stage(id),
    enabled             boolean NOT NULL DEFAULT false,
    mode                varchar(8) NOT NULL DEFAULT 'html'
                        CHECK (mode IN ('html', 'ai')),
    template_ids_json   text NOT NULL DEFAULT '[]',
    media_json          text NOT NULL DEFAULT '[]',
    version             integer NOT NULL DEFAULT 1,
    is_deleted          smallint NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_node_experience_stage
    ON node_experience(stage_id)
    WHERE is_deleted = 0;

-- 用户明信片记录与最终 PNG 图片。
CREATE TABLE IF NOT EXISTS user_postcard (
    id                      bigint PRIMARY KEY,
    user_id                 bigint NOT NULL REFERENCES app_user(id),
    route_id                bigint NOT NULL REFERENCES puzzle_route(id),
    stage_id                bigint NOT NULL REFERENCES route_stage(id),
    visit_id                bigint NOT NULL REFERENCES user_route_visit(id),
    template_id             bigint NOT NULL REFERENCES postcard_template(id),
    source_attachment_id    bigint NULL,
    task_id                 bigint NULL,
    route_title             text NOT NULL,
    stage_title             text NOT NULL,
    caption                 varchar(160) NOT NULL DEFAULT '',
    mode                    varchar(8) NOT NULL,
    locale                  varchar(16) NOT NULL,
    snapshot_json           text NOT NULL,
    status                  varchar(16) NOT NULL DEFAULT 'pending',
    error                   text NULL,
    image_bytes             bytea NULL,
    idempotency_key         varchar(80) NOT NULL,
    is_deleted              smallint NOT NULL DEFAULT 0,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_user_postcard_history
    ON user_postcard(user_id, created_at DESC)
    WHERE is_deleted = 0;

COMMIT;
