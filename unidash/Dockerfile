FROM nginx:alpine

# Install Python and Docker CLI
RUN apk add --no-cache python3 curl \
    && curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-24.0.7.tgz -o docker.tgz \
    && tar xzvf docker.tgz --strip 1 -C /usr/local/bin docker/docker \
    && rm docker.tgz \
    && chmod +x /usr/local/bin/docker

# Copy Frontend Build
COPY frontend/dist /usr/share/nginx/html

# Copy Generator Script
COPY gen.py /app/gen.py

# Startup Script
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]

