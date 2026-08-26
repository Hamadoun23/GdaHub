# Image du shell React de GDA Hub.

FROM node:22-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

FROM base AS developpement
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM base AS production
RUN npm run build
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
