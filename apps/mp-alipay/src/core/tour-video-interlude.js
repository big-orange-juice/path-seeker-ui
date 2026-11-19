const storage = require('../services/storage');

function configured(stop) {
  return !!(stop && stop.video && Number.isInteger(stop.videoTriggerPercent) && stop.videoTriggerPercent > 0 && stop.videoTriggerPercent < 100);
}

// 只累计讲解章节；前后置音频、车夫语音和服务端预生成进度都不能推进插播时钟。
function progress(stop, narration, itemId, time, duration) {
  if (!configured(stop) || !narration || !Number.isFinite(time) || time < 0) return null;
  const chapters = (narration.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.id).localeCompare(String(b.id)));
  const index = chapters.findIndex(chapter => chapter.id === itemId);
  if (index < 0) return null;
  const durations = chapters.map((chapter, i) => i === index && duration > 0 ? duration : chapter.durationSeconds);
  if (durations.some(seconds => !Number.isFinite(seconds) || seconds <= 0)) return null;
  const total = durations.reduce((a, b) => a + b, 0);
  const elapsed = durations.slice(0, index).reduce((a, b) => a + b, 0) + Math.min(time, durations[index]);
  return elapsed / total * 100;
}

function identity(page, stop) {
  const visit = page.data.visit, route = page.data.route, guide = page.data.guides[page.data.guideIndex];
  if (!visit || !route || !guide) return '';
  return [visit.visitId, route.id, page.data.locale, guide.guideId, stop.id, stop.videoAttachmentId || stop.video].join('|');
}

function claim(page, stop) {
  const key = identity(page, stop);
  if (!key) return false;
  const storageKey = storage.scoped(page._user, 'video-interludes');
  const entries = storage.read(storageKey, []);
  const memory = page._videoInterludes || (page._videoInterludes = new Set());
  if (memory.has(key) || Array.isArray(entries) && entries.includes(key)) return false;
  memory.add(key);
  // 开始前落盘，避免刷新或迟到的 ended 回调再次插播；新行程使用新的 visitId。
  try { storage.write(storageKey, (Array.isArray(entries) ? entries : []).concat(key).slice(-128)); } catch (_) { /* 缓存不可写时保留当前页面去重。 */ }
  return true;
}

module.exports = { configured, progress, claim };
