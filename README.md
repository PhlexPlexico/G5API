# G5API - A Tournament Management API Backend for Get5
_**Status: Supported.**_

No more features will be actively developed, but supoprt will still be given if you need assistance in setting things up. Pull Requests are always welcome and will be reviewed!

With the recent developments of Counter-Strike Sharp, there are a few plugins which have graciously added support for G5API. Huge thanks to [MatchZy](https://shobhit-pathak.github.io/MatchZy/) and [PugSharp](https://github.com/Lan2Play/PugSharp) for adding support to this project.

G5API is a replacement for the get5-webpanel. This is the backend only, as it will allow the plugin to interface with a database, Steam OAuth, Local Logins, and API Keys, as well as make various calls to functionality that is seen in the [get5-web](https://github.com/phlexplexico/get5-web).

If you would like a supplemental front-end, please see [Get5Vue](https://github.com/phlexplexico/g5v) or use the [docker-compose](https://github.com/PhlexPlexico/G5API/blob/master/docker-compose.yml) located in the repo!

---

Like The Project? Feel free to sponsor it! Click the Sponsor button on the repo to see all the possible ways of supporting this development!  
![Sponsor me](https://phlexplexi.co/sponsor.png)

If you've donated and would like to have your name listed as a sponsor, please message me on Twitter!

---

## What does it do?
G5API is an API that will allow users to create, manage, and control Counter-Strike 2 (CS2) matches. Add teams, create matches, and most importantly, track statistics across matches, and create Seasons/Tournaments to track stats within date ranges.  

This API is complete enough to provide the most functionality out of [get5](https://github.com/splewis/get5), and has support for events that are fired off from [MatchZy](https://shobhit-pathak.github.io/MatchZy/) and [PugSharp](https://github.com/Lan2Play/PugSharp).

There is also Challonge integration within the API. If a user provides a tournament ID to create a season, it will auto-fill a season start date, empty teams, and will auto-update the brackets at the end of each match if the match exists under the Season/Tournament.

# What does it NOT do?
As stated, this is an API and does not contain a front end. You can either create your own front-end, or use [G5V](https://github.com/phlexplexico/g5v) to provide a simple, but effective front-end experience.

# Why?
[Get5-web](https://github.com/phlexplexico/get5-web) is a now out-dated webpanel, with python2.7 being officially EOL. Being built all on Flask, with ORM (SQLAlchemy), and Jinja2, its tech spans more than a few years old. While it works really well for now, it is becoming increasingly harder to deploy to more modern hardware/software (such as Ubuntu 19) to ensure easy setup.

The intent will to be provide similar functionality with the use of NodeJS and Express, and this API will take care of session authentication as well, via the use of [`passport-steam`](https://github.com/liamcurry/passport-steam), and rcon server commands via [`rcon`](https://github.com/pushrax/node-rcon), as well as more normalization in the database.

# Building
In order to build this application, I've opted to use [Yarn](https://yarnpkg.com/lang/en/).

First you will need to copy over the ```development/test/production.json.template``` and update any values that are required. These include server values, and database passwords and connections. For more information, please see [configuration](https://github.com/PhlexPlexico/G5API/wiki/Configuration).

If you wish to roll a production build, please copy ```production.json.template``` and fill out all the values.

To see initial configuration/installation on your server, please [visit the wiki](https://github.com/PhlexPlexico/G5API/wiki/) to learn more about first-time setup. Node, Redis, and MariaDB/MySQL are all pre-requisites, and the wiki will provide you with information on how to set it up, as well as some useful information about the templated configuration files. *However, it is recommended to use the Docker build, or the docker compose file, please read beLow for further information.*

### Migrate dev database: 
```yarn migrate-create-dev && yarn migrate-dev-upgrade```

You can specify which database to use in the `development.json` area. *Please note that this will delete and recreate the development table.* Also note that there are some tables that have changed. I've opted to normalizing the spectators and team authentication values, as BLOBS were not playing nicely with Node. My current fork deals with inserting into these tables, so I hope that it will eventually be a smooth transition where you can keep all your data from the old Flask app, if you so choose.

### Migrate production database:
```yarn migrate-create-prod && yarn migrate-prod-upgrade```

This will attempt to update a production database by creating any tables that don't exist. It will not drop the database prior to importing new tables. If you are on windows, you will just have to create the database yourself, and then run `yarn migrate-prod-upgrade`.

### Build and run: 
```yarn start``` 

Spins up a development server (by default, please use the `NODE_ENV` variable to change this) where you can make all your calls. Since steam authentication is enabled, you will need to auth with Steam first before making any calls that would modify any data.

### Docker Build Instructions:
This guide assumes you have a MariaDB or MySQL compatible server running. You can deploy one in docker following the [MariaDB guide](https://hub.docker.com/_/mariadb/).

Build your docker image.
Run the command ```docker build -t yourname\g5api:latest .```
Once this has finished, you can run the container using 
```sh
docker container run --name g5api \
-p 3301:3301 \
-v redisVol:/RedisFiles \
-e PORT="3301" \
-e HOSTNAME="" \
-e DBKEY="" \
-e STEAMAPIKEY="" \
-e SHAREDSECRET="" \
-e CLIENTHOME="" \
-e APIURL="" \
-e SQLUSER="" \
-e SQLPASSWORD="" \
-e DATABASE="" \
-e SQLHOST="" \
-e SQLPORT="" \
-e ADMINS="" \
-e SUPERADMINS="" \
-e REDISURL="" \
-e REDISTTL="" \
-e USEREDIS="true" \
-e UPLOADDEMOS="" \
-e LOCALLOGINS="" \
yourname\g5api:latest
```

### Docker Compose Instructions
This guide will get you to setup a running instance for a reverse proxy (Caddy), G5API, and G5V running all at once.  
Provided in this repository is a `docker-compose.yml` file. Much like the above Docker run commands, all those fields are required in the docker file, as well as a few additional parameters that need to be adjusted. We'll go through setting up the Caddy reverse proxy, and without.  
The first thing needed, however, is a network bridge, and this can be done by calling `docker network create -d bridge get5`.

#### With Caddy
A few changes need to be created in order to get the reverse proxy working either with HTTPS or just HTTP. It is recommeneded you use a DNS (duckdns for example) as it will allow for HTTPS. Inside the [docker-compose](./docker-compose.yml) you will find various references to `localhost`. Please change these values according to whatever your host is. **These will exist in lines 46, 54, 56, 57, and 80**. Once that is done, and all the other aforementioned information is filled in, you can call `docker-compose up -d` to run the application. After a few minutes of setup, it should be accessible.

#### Without Caddy
If you already have a webserver setup, and reverse proxies enabled with another tool (such as NGINX, Apache, Caddy, etc.), you may **remove all the labels associated with** `caddy`, and remove the `caddy` image itself. After that, fill in the aforementioned data (the **localhost bits included on lines 54, 56, 57**) that is required and call `docker-compose up -d` and wait a few minutes for it to launch, and it will be available.

*If there are any issues with starting the container*, please observe the log using (provided you didn't change the container names) `docker container logs g5api` and see where it is failing to launch. Using docker logs is a very useful tool for debugging and checking why a build is failing.


For more details on these variables, follow along with production.json.template located in /config
### Docs: 
```yarn doc```

This will generate all the API information that I've created in the app, in the hopes of making it more readable and easier to pickup for anyone who wants to try implementing more actions, or even creating a front-end for this API. Swagger Express is also included, which can be accessed from `/api-docs` on application launch. This will house all the API calls, where JSDocs will show all the internal function calls in this application. All TypeScript functions will be shown in the JSDocs.

### Coverage Tests
Steam OAuth will be mocked in order to check if a user is "logged in", and create a temporary database (`get5test`) that will insert new values, and check various features of routes. If you wish to alter the "user" it authenticates as, you can edit `utility/mockProfile.js` to the values you prefer.

```yarn test```

Will *require* `test.json` to exist in projects `config` folder. It will grab the value from `./utility/mockProfile.js` to set it as a `super_admin` temporarily, then remove it after. These tests are mainly meant for CI, and will be the go-to to test if any changes break the application.

# Contribution
If you have a knack for APIs and a penchant for JavaScript, I could always use help! Create a fork of this application, make your changes, and submit a PR. I will be using the [Issues](https://github.com/phlexplexico/G5API/issues) page to track what calls still need to be completed. Even though this project is "complete" in a sense of it does what it says on the tin, I wouldn't be opposed to new features or suggestions on how to make the API better!

If you so choose to contribute, please make sure you include documentation for the API calls, as it is how I am keeping track of all the functionality. I'm using [JSDoc](https://devdocs.io/jsdoc/) as well as [Swagger](https://swagger.io) to provide documentation. Please read over some of the files to get accustomed to usage.

If you are creating a front-end for this, please create an issue and let me know, so I can append it to the README, so other users' will be able to easily track it down.

# License
This project is licensed under [MIT License](http://opensource.org/licenses/MIT). A copy of this license **must be included with the software**.
