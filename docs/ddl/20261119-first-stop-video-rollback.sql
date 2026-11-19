-- A线首节点视频测试配置回退。仅当仍是本次版本与素材时执行。
BEGIN;
UPDATE public.route_stage_narration
SET video_attachment_id = NULL, video_trigger_percent = NULL, version = version + 1, updated_at = NOW()
WHERE id = 1880640659615759267 AND stage_id = 1880640659615759266
  AND version = 13 AND video_attachment_id = 2123440837881892864 AND video_trigger_percent = 70;
-- 应更新1行；若为0，请先审查后续编辑，不要强制覆盖。
COMMIT;
