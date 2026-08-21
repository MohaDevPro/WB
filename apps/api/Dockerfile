FROM node:22-alpine AS build
WORKDIR /app
COPY apps/api/package.json ./package.json
RUN npm install --ignore-scripts
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./
COPY apps/api/src ./src
COPY database ./database
RUN npx tsc -p tsconfig.build.json

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/database ./database
EXPOSE 4000
CMD ["node", "dist/main.js"]
