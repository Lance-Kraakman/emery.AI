#!/bin/bash
# SSH Sync Server Setup Script for EC2
#
# Called by CDK user_data with environment variables:
#   EFS_ID - EFS filesystem ID to mount
#   API_HOST - Internal API URL for key fetching
#   INTERNAL_API_SECRET - Secret for API auth
#
# This script configures an Amazon Linux 2023 EC2 instance as an SSH/rsync
# server for Tauri desktop client workspace synchronization.

set -e

echo "=== Installing dependencies ==="
yum update -y
yum install -y rsync amazon-efs-utils curl

echo "=== Mounting EFS ==="
mkdir -p /workspace
mount -t efs -o tls "${EFS_ID}":/ /workspace
echo "${EFS_ID}:/ /workspace efs _netdev,tls 0 0" >> /etc/fstab

echo "=== Creating agent user ==="
useradd -m -s /bin/bash agent
mkdir -p /home/agent/.ssh
chown agent:agent /home/agent/.ssh
chmod 700 /home/agent/.ssh

echo "=== Setting up workspace permissions ==="
mkdir -p /workspace/workspaces
chown -R 1000:1000 /workspace/workspaces
chmod 755 /workspace/workspaces

echo "=== Creating fetch-keys script ==="
cat > /usr/local/bin/fetch-keys.sh << 'FETCHEOF'
#!/bin/bash
# Fetch authorized SSH keys from the API
# Called by sshd's AuthorizedKeysCommand on each SSH connection
source /etc/ssh-sync-env
curl -sf -H "X-Internal-Secret: ${INTERNAL_API_SECRET}" \
  "${API_HOST}/api/internal/authorized-keys" 2>/dev/null || true
FETCHEOF
chmod +x /usr/local/bin/fetch-keys.sh

echo "=== Storing environment variables ==="
cat > /etc/ssh-sync-env << ENVEOF
export API_HOST="${API_HOST}"
export INTERNAL_API_SECRET="${INTERNAL_API_SECRET}"
ENVEOF
chmod 600 /etc/ssh-sync-env

echo "=== Configuring sshd ==="
cat >> /etc/ssh/sshd_config << 'SSHDEOF'

# Fetch authorized keys from API for workspace sync
AuthorizedKeysCommand /usr/local/bin/fetch-keys.sh %u
AuthorizedKeysCommandUser root
SSHDEOF

echo "=== Restarting sshd ==="
systemctl restart sshd

echo "=== SSH sync server setup complete! ==="
