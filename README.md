# G5API - API Backend for Get5
_**Status: Alpha. Under active development.**_

G5API is going to be a replacement for the get5-webpanel. _Currently_ this is the backend only, as it will allow the plugin to interface with a database and Steam OAuth, as well as make various calls to functionality that is seen in the [get5-webpanel](https://github.com/phlexplexico/get5-webpanel)


## What does it do?
Currently, very basic CRUD operations, as well as legacy calls that the get5-web api used, as referenced [here](https://github.com/PhlexPlexico/get5-web/blob/development/get5/api.py). Right now, this is a very early build to try my hand at using Express as a middleware, and try some JavaScript technologies so that others may create their own front-end applications, with all the difficult back-end stuff being completed. 


This API should be complete enough to do basic operations to the game and match creation.

For the get5_api plugin, there are legacy routes currently put into place located in the `./routes/legacy/` and still point to `/match/` on this app. So this could techinically be used as a drop-in replacement for recording stats.

Game server interaction will still take place under the `/matches/:match_id` directive, but the logic can be found under `./matches/matchserver.js`.


## What does it NOT do?
This is simply a back-end to get myself used to JavaScript and Node. Maybe eventually I will work on a front-end in React or Vue, but it depends on how long I stay motivated with this. Right now you should be able to log into Steam, and query the data that is currently existing in your database, as well as make any modifications via POST/PUT/DELETE commands, and create matches on a server/setup a game and have it record stats.

## Why?
[Get5-webpanel](https://github.com/phlexplexico/get5-webpanel) is a now out-dated webpanel, with python2.7 being officially EOL. Being built all on Flask, with ORM (SQLAlchemy), and Jinja2, its tech spans more than a few years old. While it works really well for now, it is becoming increasingly harder to deploy to more modern hardware/software (such as Ubuntu 19) to ensure easy setup.

The intent will to be provide similar functionality with the use of NodeJS and Express, and this API will take care of session authentication as well, via the use of [`passport-steam`](https://github.com/liamcurry/passport-steam), and rcon server commands via [`rcon-srcds`](https://github.com/EnriqCG/rcon-srcds), as well as more normalization in the database.

## Building
In order to build this application, I've opted to use [Yarn](https://yarnpkg.com/lang/en/).

First you will need to copy over the ```development/test/production.json.template``` and update any values that are required. These include server values, and database passwords and connections. For more information, please see [configuration](https://github.com/PhlexPlexico/G5API/wiki/Configuration).

If you wish to roll a production build, please copy ```production.json.template``` and fill out all the values.

To see initial configuration/installation on your server, please [visit the wiki](https://github.com/PhlexPlexico/G5API/wiki/) to learn more about first-time setup. Node, Redis, and MariaDB/MySQL are all pre-requisites, and the wiki will provide you with information on how to set it up, as well as some useful information about the templated configuration files.

### Migrate dev database: 
```yarn migrate-dev-create && yarn migrate-dev-upgrade```

You can specify which database to use in the `development.json` area. *Please note that this will delete and recreate the development table.* Also note that there are some tables that have changed. I've opted to normalizing the spectators and team authentication values, as BLOBS were not playing nicely with Node. My current fork deals with inserting into these tables, so I hope that it will eventually be a smooth transition where you can keep all your data from the old Flask app.

### Migrate production database:
```yarn migrate-prod-create && yarn migrate-prod-upgrade```

This will attempt to update a production database by creating any tables that don't exist. It will not drop the database prior to importing new tables.

### Build and run: 
```yarn start``` 

Spins up a development server where you can make all your calls. Since steam authentication is enabled, you will need to auth with steam first before making any calls.

### Docs: 
```yarn doc```

This will generate all the API information that I've created in the app, in the hopes of making it more readable and easier to pickup for anyone who wants to try more implementation, or even creating a front-end for this API.

### Coverage Tests
Steam OAuth will be mocked in order to check if a user is "logged in", and create a temporary database (`get5test`) that will insert new values, and check various features of routes. If you wish to alter the "user" it authenticates as, you can edit `utility/mockProfile.js` to the values you prefer.

```yarn test```

Will *require* `test.json` to exist in projects `config` folder. It will grab the value from `./utility/mockProfile.js` to set it as a `super_admin` temporarily, then remove it after. These tests are mainly meant for CI, and will be the go-to to test if any changes break the application.

## Contribution
Sure! If you have a knack for APIs and a penchant for JavaScript, I could always use help! Create a fork of this application, make your changes, and submit a PR. I will be using the [Issues](https://github.com/g5api/issues) page to track what calls still need to be completed. This project won't be finished anytime soon, as I would like to make sure there is a proper handle on authentication with the API, as well as proper security implemented to prevent any unwanted uses with the application. 

If you so choose to contribute, please make sure you include documentation for the API calls, as it is how I am keeping track of all the functionality. I'm using [JSDoc](https://devdocs.io/jsdoc/) to provide documentation, which will eventually be moved over to a wiki.

If you are creating a front-end for this, please create an issue and let me know, so I can append it to the README, so other users' will be able to easily track it down.

# License
This project is licensed under [MIT License](http://opensource.org/licenses/MIT). A copy of this license **must be included with the software**.
