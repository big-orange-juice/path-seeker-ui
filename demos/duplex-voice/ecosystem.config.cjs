/**
 * PM2 部署配置：与 apps/web-admin/ecosystem.config.cjs 同一套风格。
 * 服务器上（/usr/zhm/demo_tts）：
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'demo-tts',
      cwd: __dirname,
      script: 'server/index.js',
      interpreter: 'node',
      exec_mode: 'fork',
      // 会话状态（历史/打断状态）在进程内存里，必须单实例；
      // 想扩多实例得在 Nginx 上做 ip_hash 粘性，否则打断和上下文会串。
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        // 只监听本机，公网统一走 Nginx（Nginx 负责 TLS）
        DEMO_HOST: '127.0.0.1',
        DEMO_PORT: '5178',
        // 必须与 Nginx location 前缀完全一致
        DEMO_BASE_PATH: '/demo_tts',
        // 密钥优先放这里或 systemd 的 EnvironmentFile；留空则读 config.json
        MINIMAX_API_KEY: '',
        DEEPSEEK_API_KEY: '',
        // 配置放在仓库外时指定路径（推荐：chmod 600，部署目录不带密钥）
        // DEMO_CONFIG: '/etc/path-seeker/demo-tts.config.json'
      }
    }
  ]
};
