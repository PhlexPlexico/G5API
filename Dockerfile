FROM node:18-alpine

RUN apk add gettext python3 build-base
EXPOSE 3301
# clone and move into Get5API folder
WORKDIR /Get5API
COPY . .
RUN yarn
RUN yarn build
# set config with env variables, build, and run application
CMD envsubst < /Get5API/config/production.json.template > /Get5API/config/production.json  && \
    sed -i "s/db:create get5$/db:create $DATABASE/" /Get5API/package.json && \
    yarn migrate-create-prod && \
    yarn migrate-prod-upgrade && \
    yarn startprod && \
    yarn pm2 logs
