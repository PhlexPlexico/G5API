FROM redis:latest
USER root 

# api port
EXPOSE 3301

# update and install initial packages
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
	curl \
	apt-transport-https \
	lsb-release \
	gnupg

# add yarn repo
RUN curl https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

# install npm
SHELL ["/bin/bash", "--login", "-c"]
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
RUN nvm install 13.8.0

# install yarn
RUN apt-get update && apt-get install --no-install-recommends -y \
  yarn
  
# copy git files and customized config files to folder Get5API
RUN mkdir /Get5API && mkdir /RedisFiles
COPY ./ /Get5API/
COPY ./config/redis.conf /etc/redis/redis.conf
COPY ./config/production.json /Get5API/config/production.json

# move into Get5API folder
WORKDIR /Get5API

# build application
RUN yarn install --production
RUN yarn migrate-create-prod && yarn migrate-prod-upgrade && yarn

# run application
CMD redis-server /etc/redis/redis.conf --daemonize yes --appendonly yes && NODE_ENV=production yarn start