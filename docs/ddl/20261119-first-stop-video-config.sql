-- 已于2026-11-19在目标库执行；重放前先执行结构DDL。
-- 原值：video_attachment_id=NULL，未配置插播，version=12。
-- 只绑定指定视频及70%进度，保留解说词、音频、分段、图片及路线编排。
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.route_stage
        WHERE id = 1880640659615759266 AND route_id = 2116113373455323136
          AND sort_order = 1 AND title = '什刹海体校' AND is_deleted = 0
    ) THEN
        RAISE EXCEPTION 'A线首节点与预期不一致，停止配置';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.attachment
        WHERE id = 2123440837881892864 AND mime_type LIKE 'video/%' AND is_deleted = 0
    ) THEN
        RAISE EXCEPTION '指定测试视频附件不存在，停止配置';
    END IF;
    UPDATE public.route_stage_narration
    SET video_attachment_id = 2123440837881892864,
        video_trigger_percent = 70, version = version + 1, updated_at = NOW()
    WHERE id = 1880640659615759267 AND stage_id = 1880640659615759266
      AND locale = 'zh' AND version = 12 AND video_attachment_id IS NULL AND is_deleted = 0;
    IF NOT FOUND AND NOT EXISTS (
        SELECT 1 FROM public.route_stage_narration
        WHERE id = 1880640659615759267 AND stage_id = 1880640659615759266
          AND video_attachment_id = 2123440837881892864 AND video_trigger_percent = 70 AND is_deleted = 0
    ) THEN
        RAISE EXCEPTION '首节点已被编辑，停止覆盖';
    END IF;
END $$;
COMMIT;
