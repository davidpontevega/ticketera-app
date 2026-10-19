#!/bin/bash
# Corre en la EC2 (via SSM Run Command): bash deploy.sh <tag-de-imagen>
set -euo pipefail
TAG="$1"
REGION=us-east-2
REGISTRY=282380327294.dkr.ecr.${REGION}.amazonaws.com
IMAGE=${REGISTRY}/ticketera
ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker pull "$IMAGE:$TAG"
docker pull "$IMAGE:$TAG-migrate"

aws ssm get-parameters-by-path --region "$REGION" --path /ticketera --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text | sed 's|^/ticketera/||; s|\t|=|' > "$ENV_FILE"

docker run --rm --env-file "$ENV_FILE" "$IMAGE:$TAG-migrate"

docker rm -f ticketera 2>/dev/null || true
docker run -d --name ticketera --restart unless-stopped --env-file "$ENV_FILE" -p 3000:3000 \
  --log-driver awslogs --log-opt awslogs-region="$REGION" --log-opt awslogs-group=/ticketera/app \
  "$IMAGE:$TAG"

for _ in $(seq 1 30); do
  curl -fs http://localhost:3000/api/health && exit 0
  sleep 2
done
docker logs --tail 50 ticketera
exit 1
