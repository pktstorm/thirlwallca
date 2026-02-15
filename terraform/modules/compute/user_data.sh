#!/bin/bash
set -euo pipefail
exec > /var/log/user-data.log 2>&1

echo "=== Starting Thirlwall.ca server provisioning ==="

# Update system
dnf update -y

# ---------------------------------------------------------------------------
# PostgreSQL 16 (latest available on AL2023)
# ---------------------------------------------------------------------------
dnf install -y postgresql15-server postgresql15-server-devel postgresql15-contrib rsync
postgresql-setup --initdb
systemctl enable postgresql
systemctl start postgresql

# Configure PostgreSQL authentication
sudo -u postgres psql -c "CREATE USER thirlwall WITH PASSWORD '${db_password}';"
sudo -u postgres psql -c "CREATE DATABASE thirlwall OWNER thirlwall;"
sudo -u postgres psql -d thirlwall -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
sudo -u postgres psql -d thirlwall -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";"

# Allow password-based connections (keep peer for postgres user)
cat > /var/lib/pgsql/data/pg_hba.conf << 'PGHBA'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            ident
host    replication     all             ::1/128                 ident
PGHBA
systemctl restart postgresql

# ---------------------------------------------------------------------------
# Python 3.12 + Poetry
# ---------------------------------------------------------------------------
dnf install -y python3.12 python3.12-pip python3.12-devel gcc

# Install Poetry
curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python3.12 -
ln -sf /opt/poetry/bin/poetry /usr/local/bin/poetry

# ---------------------------------------------------------------------------
# Application directory + .env
# ---------------------------------------------------------------------------
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

cat > /home/ec2-user/app/.env << ENVEOF
# Database
DATABASE_URL=postgresql+asyncpg://thirlwall:${db_password}@localhost:5432/thirlwall

# AWS
AWS_REGION=${aws_region}

# Cognito
COGNITO_USER_POOL_ID=${cognito_user_pool_id}
COGNITO_CLIENT_ID=${cognito_client_id}
COGNITO_REGION=${aws_region}

# S3
S3_MEDIA_BUCKET=${s3_media_bucket}
S3_REGION=${aws_region}

# API
API_CORS_ORIGINS=https://${domain_name}
ENVEOF

chown ec2-user:ec2-user /home/ec2-user/app/.env
chmod 600 /home/ec2-user/app/.env

# ---------------------------------------------------------------------------
# Systemd service for FastAPI
# ---------------------------------------------------------------------------
cat > /etc/systemd/system/thirlwall-api.service << 'EOF'
[Unit]
Description=Thirlwall.ca API
After=network.target postgresql.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/app
EnvironmentFile=/home/ec2-user/app/.env
Environment=PATH=/home/ec2-user/app/.venv/bin:/usr/local/bin:/usr/bin
ExecStart=/home/ec2-user/app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --forwarded-allow-ips="*" --proxy-headers
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable thirlwall-api

echo "=== Thirlwall.ca server provisioning complete ==="
