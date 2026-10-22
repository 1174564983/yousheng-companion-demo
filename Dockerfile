FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# The Render free build instance does not have enough memory to install the
# Vite toolchain. `dist/` is built and committed before pushing.
COPY dist ./dist
COPY server ./server
COPY package.json ./package.json

EXPOSE 8080
CMD ["node", "server/index.mjs"]
