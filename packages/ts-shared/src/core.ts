/**
 * 这个文件只放多个共享契约都会用到的基础类型别名。
 *
 * 后端 swagger 里目前同时混用了：
 * - `int64`
 * - `string`
 * - nullable id
 * - 各种响应包装壳
 *
 * 前端没有必要把这些传输层细节一路带到 store 和组件里。
 * 这一层的职责是先把基础原语统一成前端友好的形态，真正的
 * DTO -> 共享类型映射交给各个应用自己的 API adapter 处理。
 */

/**
 * 前端领域层统一使用的实体 id。
 *
 * 这里固定成 `string`，原因是：
 * - swagger 里请求和响应对同一个 id 字段的类型并不完全一致
 * - 路线、谜题、线索、奖励等 id 在前端状态里最好保持同一种形态
 * - 写入本地缓存、路由参数、分享参数时，字符串更稳定
 */
export type EntityId = string

/**
 * 归一化后的 ISO-8601 时间字符串。
 *
 * 共享层只保留字符串，不直接转成 `Date`。因为不同端对时区、
 * 显示格式、序列化方式的要求不一样，这部分应该放在应用层处理。
 */
export type IsoDateTimeString = string

/**
 * 分数值。
 *
 * swagger 里目前以整数出现，这里单独起别名只是为了在路线、结果、
 * 奖励等模型里让语义更清楚。
 */
export type ScoreValue = number

/**
 * 时长，单位固定为秒。
 *
 * 单独起别名是为了避免后续和毫秒混用。
 */
export type DurationSeconds = number
