function createUtf8Decoder() {
  let pending = [];
  function decode(data, final = false) {
    if (typeof data === 'string') { if (pending.length) throw Error('问答分块编码不一致'); return data; }
    const incoming = data == null ? [] : Array.from(data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    const bytes = pending.concat(incoming);
    let output = '', offset = 0;
    while (offset < bytes.length) {
      const first = bytes[offset];
      const length = first < 128 ? 1 : first >= 194 && first <= 223 ? 2 : first >= 224 && first <= 239 ? 3 : first >= 240 && first <= 244 ? 4 : 0;
      if (!length) throw Error('问答分块不是有效 UTF-8');
      if (offset + length > bytes.length) break;
      let point = first & (length === 1 ? 127 : length === 2 ? 31 : length === 3 ? 15 : 7);
      for (let position = 1; position < length; position++) {
        const byte = bytes[offset + position];
        if ((byte & 192) !== 128) throw Error('问答分块不是有效 UTF-8');
        point = (point << 6) | (byte & 63);
      }
      if (length === 2 && point < 128 || length === 3 && point < 2048 || length === 4 && point < 65536 || point >= 55296 && point <= 57343 || point > 1114111) throw Error('问答分块不是有效 UTF-8');
      output += point <= 65535 ? String.fromCharCode(point) : String.fromCharCode(55296 + ((point - 65536) >> 10), 56320 + ((point - 65536) & 1023));
      offset += length;
    }
    pending = bytes.slice(offset);
    if (final && pending.length) throw Error('问答分块数据不完整');
    return output;
  }
  return { decode, finish: () => decode(null, true) };
}
module.exports = { createUtf8Decoder };
