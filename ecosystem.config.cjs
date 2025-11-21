module.exports = {
  apps: [{
    name: 'vibely-backend',
    script: './node_modules/.bin/tsx',
    args: 'server/index.ts',
    cwd: '/var/www/vibely',
    instances: 1,
    exec_mode: 'fork',     // ← Added here
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
