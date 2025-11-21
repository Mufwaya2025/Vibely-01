module.exports = {
  apps: [{
    name: 'vibely-backend',
    script: './node_modules/.bin/tsx',
    args: 'server/index.ts',
    cwd: '/var/www/vibely',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      CLIENT_ORIGIN: 'https://vibelyapp.live,https://www.vibelyapp.live',
      // Lenco testing defaults
      LENCO_ENV: 'sandbox',
      LENCO_USE_MOCK_GATEWAY: 'true',
      // Optional: set real keys here for live/sandbox
      LENCO_PUBLIC_KEY: '',
      LENCO_SECRET_KEY: ''
    }
  }]
};
