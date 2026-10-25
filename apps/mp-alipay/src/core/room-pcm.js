function wavPcm(buffer) {
  const view = new DataView(buffer);
  const ascii = offset => String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
  if (view.byteLength < 44 || ascii(0) !== 'RIFF' || ascii(8) !== 'WAVE') throw Error('录音格式不支持，请更新支付宝后重试');
  let valid = false, pcm = null;
  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const size = view.getUint32(offset + 4, true), start = offset + 8;
    if (start + size > view.byteLength) throw Error('录音文件不完整');
    if (ascii(offset) === 'fmt ') valid = size >= 16 && view.getUint16(start, true) === 1 && view.getUint16(start + 2, true) === 1 && view.getUint32(start + 4, true) === 16000 && view.getUint16(start + 14, true) === 16;
    if (ascii(offset) === 'data') pcm = buffer.slice(start, start + size);
    offset = start + size + size % 2;
  }
  if (!valid || !pcm || pcm.byteLength % 2) throw Error('需要 16 kHz 单声道 16 位 WAV 录音');
  return pcm;
}
function base64(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', bytes = new Uint8Array(buffer);
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const value = (bytes[index] << 16) | ((bytes[index + 1] || 0) << 8) | (bytes[index + 2] || 0);
    encoded += alphabet[(value >>> 18) & 63] + alphabet[(value >>> 12) & 63] + (index + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : '=') + (index + 2 < bytes.length ? alphabet[value & 63] : '=');
  }
  return encoded;
}
module.exports = { wavPcm, base64 };
