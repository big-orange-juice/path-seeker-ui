# RMS + WebRTC VAD 验证记录

日期：2026-10-28。

## 自动测试

- 针对切段器、组合检测器、房间 ASR 输入：42 项通过。
- 翻译房间、切段器、语义提交、双工翻译：77 项通过。
- WebApi 构建成功，0 个错误；保留原有依赖版本、健康检查包及空引用等 20 个警告。
- 使用模拟 ASR 响应，未调用真实识别供应商。

后端关联回归命令：

```powershell
dotnet test CulturalTourismSystem.ApiTests/CulturalTourismSystem.ApiTests.csproj --no-build --no-restore --filter 'FullyQualifiedName~TranslationRoom|FullyQualifiedName~PcmSpeechSegmenter|FullyQualifiedName~TranslationCommitter|FullyQualifiedName~DuplexTranslation' --verbosity minimal
```

## 检测开销和实现对照

入口：`benchmark/Benchmark.csproj`，运行环境为本机 Windows x64、.NET 10.0.12、Release。每次调用检测 16kHz 下 320 个样本，即 20ms。输入为预先生成的静音、直流偏移、宽带噪声和调幅谐波信号。

纯 C# WebRtcVad.NET 1.0.0 与原生 WebRtcVadSharp 1.3.2 对照：每种输入 2000 帧、mode 2，总计 8000 帧结果一致。该测试覆盖有限输入，不证明整个移植在所有模式和平台等价。

组合检测每种信号预热 10000 帧，再测量 100000 帧，第二次运行结果如下：

| 输入 | 每帧耗时（微秒） | 测量区间当前线程堆分配 | 放行帧数 |
| --- | ---: | ---: | ---: |
| 静音 | 2.407 | 0 字节 | 0 |
| 直流偏移 | 2.247 | 0 字节 | 0 |
| 宽带噪声 | 2.264 | 0 字节 | 100000 |
| 调幅谐波 | 1.905 | 0 字节 | 92188 |

宽带噪声被原生和纯 C# WebRTC 均判为语音，组合检测也未过滤该测试信号。这一限制必须保留在结果解释中，不能将该基准说成“所有大噪声都能过滤”。调幅谐波不是真实人声，放行比例也不代表真实讲话召回率。

堆分配不包含实例初始化，耗时不包含采音、重采样、切段、队列、日志、网络或供应商识别。程序中的 45 房间单核占用换算只是假定每房间每秒 50 帧的线性估算，不是并发负载测试。

```powershell
dotnet run --project outputs/rms-webrtc/benchmark/Benchmark.csproj --configuration Release -p:NuGetAudit=false
```

## 待验收

真实静音底噪、风声/车声、轻声短词、连续中文、中文夹英文、邻近设备外放、移动端切后台，以及实际服务器并发负载。后端发布生效前，线上仍使用原部署版本。
