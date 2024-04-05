FROM node:16-alpine

RUN apk add gettext python3 build-base

EXPOSE 3301
# clone and move into Get5API folder
WORKDIR /Get5API
COPY . .
RUN yarn
RUN yarn build
# set config with env variables, build, and run application
CMD envsubst < /Get5API/config/production.json.template > /Get5API/config/production.json  && \
    yarn  db-migrate MYSQL_FLAGS=\"-CONNECT_WITH_DB\" --env production --config config/production.json db:create $DATABASE && \
    yarn migrate-prod-upgrade && \
    yarn startprod && \
    yarn pm2 logs
