-- PostgreSQL：节点视频按讲解进度插播。先执行本脚本，再发布后端。
-- NULL 保留原来的站点视频顺序；1..99 表示整站讲解章节的触发百分比。
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.route_stage_narration
    ADD COLUMN IF NOT EXISTS video_trigger_percent integer NULL;
COMMENT ON COLUMN public.route_stage_narration.video_trigger_percent
    IS '站点视频插播进度，1..99；NULL=沿用讲解后播放。按客户端实际讲解章节进度计算，不包含前后置音频和视频。';
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.route_stage_narration'::regclass
          AND conname = 'ck_narration_video_trigger_percent'
    ) THEN
        ALTER TABLE public.route_stage_narration
            ADD CONSTRAINT ck_narration_video_trigger_percent
            CHECK (video_trigger_percent IS NULL OR video_trigger_percent BETWEEN 1 AND 99);
    END IF;
END $$;
COMMIT;

-- 关闭插播请通过保存接口提交 videoTriggerPercent=0；这会将列恢复为 NULL。
-- 本 DDL 不自动改业务数据；A线首节点的配置使用独立、带备份的数据脚本。
