BEGIN;

CREATE TABLE IF NOT EXISTS app_user_external_identity (
    id bigint PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES app_user(id),
    provider varchar(16) NOT NULL CHECK (provider IN ('alipay', 'wechat')),
    app_id varchar(64) NOT NULL CHECK (length(app_id) > 0),
    subject_type varchar(16) NOT NULL CHECK (subject_type IN ('open_id', 'user_id', 'openid')),
    subject_id varchar(128) NOT NULL CHECK (length(subject_id) > 0),
    union_id varchar(128),
    is_deleted smallint NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_user_external_subject UNIQUE (provider, app_id, subject_type, subject_id),
    CONSTRAINT uq_app_user_external_account UNIQUE (user_id, provider, app_id),
    CONSTRAINT ck_app_user_external_subject_type CHECK (
        (provider = 'alipay' AND subject_type IN ('open_id', 'user_id'))
        OR (provider = 'wechat' AND subject_type = 'openid')
    )
);

CREATE INDEX IF NOT EXISTS ix_app_user_external_identity_user
    ON app_user_external_identity(user_id);

COMMENT ON TABLE app_user_external_identity IS '小程序平台身份；注销后保留映射，禁止自动恢复已注销账号';
COMMENT ON COLUMN app_user_external_identity.subject_id IS '平台返回的字符串身份，不做数值转换';
COMMENT ON COLUMN app_user_external_identity.union_id IS '微信可选 unionid，仅保存，不自动跨应用合并账号';
COMMENT ON COLUMN app_user.register_channel IS '1=手机号 2=邮箱 3=微信 4=Apple 5=游客 6=支付宝 99=其他';

COMMIT;
