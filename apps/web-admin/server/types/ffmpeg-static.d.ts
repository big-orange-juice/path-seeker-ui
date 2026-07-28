declare module 'ffmpeg-static' {
  /** 打包的 ffmpeg 可执行文件绝对路径；不可用时为 null */
  const ffmpegPath: string | null
  export default ffmpegPath
}
