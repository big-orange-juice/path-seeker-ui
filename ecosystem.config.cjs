module.exports = {
  apps: [
    {
      name: 'path-seeker-admin',
      cwd: __dirname,
      script: './apps/web-admin/.output/server/index.mjs',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        NITRO_PORT: 5000,
        HOST: '127.0.0.1',
        NITRO_HOST: '127.0.0.1',
        NUXT_BACKEND_BASE_URL: 'http://43.142.248.191:8199/'
      }
    }
  ]
};
