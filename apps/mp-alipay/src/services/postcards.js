const auth = require('./auth');
const http = require('./http');
const config = require('../config');

function upload(filePath) {
  const version = auth.version();
  return new Promise((resolve, reject) => my.uploadFile({
    url: config.apiBase + '/Upload/UploadImage', filePath, fileName: 'file', fileType: 'image',
    header: { Authorization: 'Bearer ' + auth.current().accessToken },
    success(response) {
      if (version !== auth.version()) { reject(Error('账号已切换')); return; }
      try { const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data; if (data.code !== 0 || !data.data || typeof data.data.fileId !== 'string') throw Error(data.message || '图片上传失败'); resolve(data.data); } catch (e) { reject(e); }
    }, fail: () => reject(Error('图片上传失败，请重试'))
  }));
}
function image(id) {
  const version = auth.version();
  return new Promise((resolve, reject) => my.downloadFile({
    url: config.apiBase + '/Postcard/Image?id=' + encodeURIComponent(id),
    header: { Authorization: 'Bearer ' + auth.current().accessToken },
    success(result) { if (version !== auth.version()) { reject(Error('账号已切换')); return; } if (result.statusCode && result.statusCode !== 200 || !(result.apFilePath || result.tempFilePath)) { reject(Error('明信片图片加载失败')); return; } resolve(result.apFilePath || result.tempFilePath); },
    fail: () => reject(Error('明信片图片加载失败，请重试'))
  }));
}
function decorate(detail, experiences) {
  (detail.stops || []).forEach(stop => {
    stop.experience = experiences.find(item => item.stageId === stop.id) || null;
    (stop.guideNarrations || []).forEach(n => (n.chapters || []).forEach((c, index) => { c.interludes = stop.experience && index < n.chapters.length - 1 ? stop.experience.media.filter(m => m.afterSegmentNo === c.order) : []; }));
  });
  return detail;
}
module.exports = { upload, image, decorate, history: page => http.request(http.query('/Postcard/History', { page })), detail: id => http.request(http.query('/Postcard/Detail', { id })) };
