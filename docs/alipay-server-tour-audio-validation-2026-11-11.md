# 正式持续讲解本地验证记录

日期：2026-11-11（北京时间）。对应本轮前后端工作区修改；尚未代用户上传生产 WebAPI 或支付宝体验版。

## 最终结果

| 检查 | 结果 | 验证范围 |
| --- | --- | --- |
| 支付宝构建与全量回归 | 407 通过，0 失败，0 跳过 | 正式会话入口、旧模式回退、状态同步、暂停、问答、视频、房间、定位、账号切换 |
| 后端相关回归 | 128 通过，0 失败，1 跳过 | 新媒体服务/控制器、到站算法、原有探针、翻译房间、司机定位、游览进度 |
| 最后恢复修复的针对性复测 | 11 通过，0 失败，0 跳过 | 重连清除静音缓冲、关闭自动播放时恢复原节点、媒体及进度回归；与前一行用例重叠，不累加为独立测试数 |
| 正式 HTTP 连续媒体 | 通过，持续约 65 秒 | 一个 GET，真实 FFmpeg 编码/解码；司机位置触发两节点，中间约一分钟静音，无游客心跳和控制请求 |
| 进度兼容 | 通过 | 较早节点的延迟完成确认保留当前节点；旧完成接口默认行为保持 |
| 前后端差异检查 | 通过 | `git diff --check` 无空白错误 |
| Android / iPhone 真机锁屏 | 尚未执行 | 本机未连接可用于实际验收的两类游客手机 |

跳过项是原有 `DriverLocationStoreTests.PostgreSql_migration_writes_deduplication_restart_queries_and_retention_boundary`，需要独立 PostgreSQL 测试连接 `DRIVER_LOCATION_TEST_CONNECTION_STRING`。真实 FFmpeg 用例全部实际执行，未因缺少 FFmpeg 跳过。

本轮正式 HTTP 测试直接经过新 `TourAudioSessionsController` 和服务端会话调度，使用可控的路线、司机位置及章节音源，输出和解码使用真实 FFmpeg。测试首先验证无 JWT 创建被拒绝、错误媒体票据被拒绝和 HEAD 不消费媒体连接，再开始单条媒体 GET。服务端观察器读取内存状态用于断言，游客侧没有状态轮询、心跳或切站控制。

第一个节点完成播送后，保持原连接；媒体时间超过 60 秒再将司机移动至第二节点。解码结果验证第 30 秒是静音，并检出两段各自不同频率的音源。只播送未确认时，行程已经记录到访、尚未错误记为收听完成。

## 报告

- 小程序全量日志：`outputs/alipay-field-validation/formal-mini-regression.log`
- 后端最终 TRX：`outputs/alipay-field-validation/formal-backend-regression.trx`
- 最后恢复修复 TRX：`outputs/alipay-field-validation/formal-resume-regression.trx`
- 正式 HTTP 独立测试 TRX：`outputs/alipay-field-validation/formal-http-continuity.trx`
- 最新正式 HTTP 音频测量：`outputs/alipay-field-validation/formal-http-continuity.json`
- 后端源报告目录：`outputs/alipay-formal-validation/`

小程序全量日志和恢复修复 TRX 对应最终修改。后端 128 项回归和最新 HTTP JSON 在最后的主动恢复缓冲修复前执行，该修复随后通过 11 项针对性复测；独立 HTTP TRX 是同一用例较早单独执行的记录。此前约 15 分钟的探针测试保留在旧现场验证记录中，不能当作本轮真机或正式业务验收。

## 交付与现场

正式代码、默认配置和构建产物已准备。继续按 [部署与现场测试步骤](alipay-server-tour-audio-deploy-test.md) 发布 WebAPI、配置新 Nginx 路径、上传支付宝体验版，然后从正常游览页验证锁屏后的 B、C 节点，而不是只在独立验证页触发提示音。

服务端持续播放依赖司机 APP 持续上传有效位置；游客只用支付宝。正常锁屏到站持续使用同一媒体连接。用户主动暂停、问答抢占或网络中断后，恢复时会重建媒体连接以清除积累的静音缓冲，未确认内容可能重新播放；即使关闭自动播放，也能恢复被中断的节点。Android、iPhone 的实际支付宝锁屏行为、生产 Nginx/CDN 和现场网络没有被本地测试替代。
