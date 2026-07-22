# Keep in sync with package.json — update when dependencies or the Node
# version change (see docs/12-dev-workflow-ci.md §12.4).
FROM node:20-bullseye

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npx", "expo", "start", "--web"]
