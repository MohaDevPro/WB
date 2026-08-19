FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/web/package.json ./package.json
RUN npm install --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/package.json apps/web/next.config.mjs apps/web/tsconfig.json apps/web/next-env.d.ts ./
COPY apps/web/app ./app
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
CMD ["npm", "run", "start"]
