# G5API - API Backend for Get5
_**Status: Under active development.**_

G5API is a replacement for the get5-webpanel. This is the backend only, as it will allow the plugin to interface with a database and Steam OAuth, as well as make various calls to functionality that is seen in the [get5-webpanel](https://github.com/phlexplexico/get5-webpanel).

If you would like a supplemental front-end, please see [Get5Vue](https://github.com/phlexplexico/g5v).


## What does it do?
G5API is an API that will allow users to create, manage, and control Counter-Strike: Global Offensive matches. Add teams, create matches, and most importantly, track statistics across the entire use of the platform, and create Seasons/Tournaments and track on those.  

This API should be complete enough to provide the most functionality out of [get5](https://github.com/splewis/get5).

For the [get5_api plugin](https://github.com/PhlexPlexico/get5-webapi), the routes currently put into place located in the `./routes/legacy/` and still point to `/match/` on this app.

Game server interaction will still take place under the `/matches/:match_id` directive, but the logic can be found under `./matches/matchserver.js`.

The webapi plugin for this can be downloaded from [here](https://github.com/PhlexPlexico/get5-webapi) to include the use of vetoes being recorded, as well as demoes being uploaded to the API once the match is complete.

## What does it NOT do?
This is simply a back-end to get myself used to JavaScript and Node. You will need a [front end](https://github.com/phlexplexico/g5v) or create something that can make it work! 

## Why?
[Get5-webpanel](https://github.com/phlexplexico/get5-webpanel) is a now out-dated webpanel, with python2.7 being officially EOL. Being built all on Flask, with ORM (SQLAlchemy), and Jinja2, its tech spans more than a few years old. While it works really well for now, it is becoming increasingly harder to deploy to more modern hardware/software (such as Ubuntu 19) to ensure easy setup.

The intent will to be provide similar functionality with the use of NodeJS and Express, and this API will take care of session authentication as well, via the use of [`passport-steam`](https://github.com/liamcurry/passport-steam), and rcon server commands via [`rcon`](https://github.com/pushrax/node-rcon), as well as more normalization in the database.

## Building
In order to build this application, I've opted to use [Yarn](https://yarnpkg.com/lang/en/).

First you will need to copy over the ```development/test/production.json.template``` and update any values that are required. These include server values, and database passwords and connections. For more information, please see [configuration](https://github.com/PhlexPlexico/G5API/wiki/Configuration).

If you wish to roll a production build, please copy ```production.json.template``` and fill out all the values.

To see initial configuration/installation on your server, please [visit the wiki](https://github.com/PhlexPlexico/G5API/wiki/) to learn more about first-time setup. Node, Redis, and MariaDB/MySQL are all pre-requisites, and the wiki will provide you with information on how to set it up, as well as some useful information about the templated configuration files.

### Migrate dev database: 
```yarn migrate-dev-create && yarn migrate-dev-upgrade```

You can specify which database to use in the `development.json` area. *Please note that this will delete and recreate the development table.* Also note that there are some tables that have changed. I've opted to normalizing the spectators and team authentication values, as BLOBS were not playing nicely with Node. My current fork deals with inserting into these tables, so I hope that it will eventually be a smooth transition where you can keep all your data from the old Flask app, if you so choose.

### Migrate production database:
```yarn migrate-prod-create && yarn migrate-prod-upgrade```

This will attempt to update a production database by creating any tables that don't exist. It will not drop the database prior to importing new tables. If you are on windows, you will just have to create the database yourself, and then run `yarn migrate-prod-upgrade`.

### Build and run: 
```yarn start``` 

Spins up a development server (by default, please use the `NODE_ENV` variable to change this) where you can make all your calls. Since steam authentication is enabled, you will need to auth with steam first before making any calls that would modify any data.

### Docker Build Instructions:
This guide assumes you have a MariaDB or MySQL compatible server running. You can deploy one in docker following the [MariaDB guide](https://hub.docker.com/_/mariadb/).

Build your docker image.
Run the command ```docker build -t yourname\g5api:latest .```
Once this has finished, you can run the container using 
```
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
-e REDISPASSWORD="" \
-e UPLOADDEMOS="" \
yourname\g5api:latest
```

### Docker Compose Instructions
This guide will get you to setup a running instance for a reverse proxy (Caddy), G5API, and G5V running all at once.  
Provided in this repository is a `docker-compose.yml` file. Much like the above Docker run commands, all those fields are required in the docker file, as well as a few additional parameters.  
- `CADDY_URL` is the URL that you wish to host everything.
- `CADDY_REVERSE_PROXY_PORT` is the port that the API is serving to. By default, this is set to 3301.
- `CADDY_API_ENDPOINT` is the end point that you wish to route from. By default, this is `api`.
- And then your mysql information is required in that file as well. 

Once those are all filled in, you need to run two more commands. The first being the network bridge, which is done via `docker network create -d bridge get5` and the redis volume which is created by calling `docker volume create redisVol`. After this, you can simply run `docker-compose up -d`.This will spin up a production instance of Get5Vue, as well as Get5API, and a reverse proxy to link everything together!

For more details on these variables, follow along with production.json.template located in /config
### Docs: 
```yarn doc```

This will generate all the API information that I've created in the app, in the hopes of making it more readable and easier to pickup for anyone who wants to try more implementation, or even creating a front-end for this API. Swagger Express is also included, which can be accessed from `/api-docs` on application launch. This will house all the API calls, where JSDocs will show all the internal function calls in this application.

### Coverage Tests
Steam OAuth will be mocked in order to check if a user is "logged in", and create a temporary database (`get5test`) that will insert new values, and check various features of routes. If you wish to alter the "user" it authenticates as, you can edit `utility/mockProfile.js` to the values you prefer.

```yarn test```

Will *require* `test.json` to exist in projects `config` folder. It will grab the value from `./utility/mockProfile.js` to set it as a `super_admin` temporarily, then remove it after. These tests are mainly meant for CI, and will be the go-to to test if any changes break the application.

## Contribution
Sure! If you have a knack for APIs and a penchant for JavaScript, I could always use help! Create a fork of this application, make your changes, and submit a PR. I will be using the [Issues](https://github.com/g5api/issues) page to track what calls still need to be completed. This project won't be finished anytime soon, as I would like to make sure there is a proper handle on authentication with the API, as well as proper security implemented to prevent any unwanted uses with the application. 

If you so choose to contribute, please make sure you include documentation for the API calls, as it is how I am keeping track of all the functionality. I'm using [JSDoc](https://devdocs.io/jsdoc/) as well as [Swagger](https://swagger.io) to provide documentation. Please read over some of the files to get accustomed to usage.

If you are creating a front-end for this, please create an issue and let me know, so I can append it to the README, so other users' will be able to easily track it down.

# License
This project is licensed under [MIT License](http://opensource.org/licenses/MIT). A copy of this license **must be included with the software**.
