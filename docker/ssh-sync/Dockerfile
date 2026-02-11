# SSH + rsync server for workspace sync
# Extends linuxserver/openssh-server with AuthorizedKeysCommand support
#
# Keys are fetched dynamically from the API on each SSH connection.
# This mirrors the production flow where users register SSH keys via the app.

FROM linuxserver/openssh-server:latest

# Install curl for fetching keys from API
RUN apk add --no-cache curl

# Copy the key fetching script
COPY fetch-keys.sh /usr/local/bin/fetch-keys.sh
RUN chmod +x /usr/local/bin/fetch-keys.sh

# Copy the restricted rsync script for org-scoped SSH keys
COPY restricted-rsync.sh /usr/local/bin/restricted-rsync.sh
RUN chmod +x /usr/local/bin/restricted-rsync.sh

# Add custom init script to configure AuthorizedKeysCommand
# linuxserver images run scripts in /custom-cont-init.d/ at startup
# This appends the config to /config/sshd/sshd_config (the actual runtime config)
# Add AuthorizedKeysCommand config and restart sshd
# This runs after services start, so we need to restart sshd to pick up changes
RUN mkdir -p /custom-cont-init.d && \
    echo '#!/bin/bash' > /custom-cont-init.d/99-authorized-keys-command && \
    echo 'echo "Configuring AuthorizedKeysCommand for API key fetch..."' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo 'if ! grep -q "^AuthorizedKeysCommand" /config/sshd/sshd_config 2>/dev/null; then' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo '  echo "" >> /config/sshd/sshd_config' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo '  echo "# Fetch authorized keys from API" >> /config/sshd/sshd_config' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo '  echo "AuthorizedKeysCommand /usr/local/bin/fetch-keys.sh %u" >> /config/sshd/sshd_config' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo '  echo "AuthorizedKeysCommandUser agent" >> /config/sshd/sshd_config' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo '  echo "Config added, restarting sshd..."' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo 'fi' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo '# Always restart sshd to ensure it uses the latest config' >> /custom-cont-init.d/99-authorized-keys-command && \
    echo 'sleep 2 && killall sshd.pam 2>/dev/null || true' >> /custom-cont-init.d/99-authorized-keys-command && \
    chmod +x /custom-cont-init.d/99-authorized-keys-command
