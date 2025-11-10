# Setting up HTTPS with Certbot for vibelyapp.live

This document explains how to install and configure Certbot to enable HTTPS on your vibelyapp.live domain.

## Prerequisites

- A server running Ubuntu/CentOS with your domain vibelyapp.live pointing to it
- Nginx installed and running
- Port 80 and 443 open
- A non-root user with sudo privileges

## Install Certbot

### On Ubuntu/Debian
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

### On CentOS/RHEL
```bash
sudo yum install certbot python3-certbot-nginx
```

### On newer distributions, you might need:
```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

## Configure Nginx for Certbot

Before obtaining a certificate, make sure your Nginx configuration is set up properly. Update your Nginx config file:

```nginx
server {
    listen 80;
    server_name vibelyapp.live www.vibelyapp.live;

    location / {
        proxy_pass http://localhost:4000;  # Your app server
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Obtain SSL Certificate

Run Certbot to obtain an SSL certificate:

```bash
sudo certbot --nginx -d vibelyapp.live -d www.vibelyapp.live
```

This command will:
- Automatically update your Nginx configuration to redirect HTTP to HTTPS
- Configure your SSL certificate
- Set up automatic renewal

## Manual Nginx Configuration (if needed)

If you prefer to configure Nginx manually after obtaining the certificate, Certbot will create a configuration that looks like this:

```nginx
server {
    listen 443 ssl;
    server_name vibelyapp.live www.vibelyapp.live;

    ssl_certificate /etc/letsencrypt/live/vibelyapp.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vibelyapp.live/privkey.pem;

    # Add security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    location / {
        proxy_pass http://localhost:4000;  # Your app server
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name vibelyapp.live www.vibelyapp.live;
    return 301 https://$server_name$request_uri;
}
```

## Test Automatic Renewal

Let's Encrypt certificates are only valid for 90 days. Test automatic renewal with:

```bash
sudo certbot renew --dry-run
```

## Additional Security Considerations

### Configure HSTS
The configuration above includes HTTP Strict Transport Security (HSTS) which tells browsers to only connect via HTTPS.

### SSL Security
To enhance security, you can add additional SSL configuration:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:RSA+AESGCM:RSA+AES:!aNULL:!MD5:!DSS;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

## Troubleshooting

### Certificate Not Renewing
Check the status of the cron job or systemd timer:
- On most systems: `sudo systemctl status certbot.timer`
- Or check cron: `sudo crontab -l`

### Nginx Restart Issues
If Nginx fails to restart after a certificate renewal, make sure your Nginx configuration is valid:
```bash
sudo nginx -t
```

### Port 80 Not Accessible
Make sure your firewall allows traffic on port 80:
```bash
sudo ufw allow 80
sudo ufw allow 443
```

## Updating Certificates

If you need to manually renew certificates:
```bash
sudo certbot renew --force-renewal
```

This setup will provide your Vibely application with a trusted SSL certificate and HTTPS encryption.