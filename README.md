# G5API - API Backend for Get5
_**Status: Alpha.**_

G5API is going to be a replacement for the get5-webpanel. _Currently_ this is the backend only, as it will allow the plugin to interface with a database and Steam OAuth, as well as make various calls to functionality that is seen in the [get5-webpanel](https://github.com/phlexplexico/get5-webpanel)


## What does it do?
Currently, very basic CRUD operations, as well as legacy calls that the get5-web api used, as referenced [here](https://github.com/PhlexPlexico/get5-web/blob/development/get5/api.py). Right now, this is a very early build to try my hand at using Express as a middleware, and try some JavaScript technologies so that others may create their own front-end applications, with all the difficult back-end stuff being completed. 


This API should be complete enough to do basic operations to the game. **Direct server operations are currently not in place** and these will exist in different routes.

For the get5_api plugin, there are legacy routes currently put into place located in the `./routes/legacy/` and still point to `/match/` on this app. So this could techinically be used as a drop-in replacement for recording stats.

Server interaction will most likely take place in `/match/:match_id/server/{rcon|start|etc}`. These command should probably be logged in the database for audit purposes as well.

## What does it NOT do?
Basically every "advanced" feature the current web panel has, from editing matches while in game, to displaying any of the data. This is simply a back-end to get myself used to JavaScript and Node. Maybe eventually I will work on a front-end in React or Vue, but it depends on how long I stay motivated with this. Right now you should be able to log into Steam, and query the data that is currently existing in your database, as well as make any modifications via POST/PUT/DELETE commands.

## Why?
[Get5-webpanel](https://github.com/phlexplexico/get5-webpanel) is a now out-dated webpanel, with python2.7 being officially EOL. Being built all on Flask, with ORM (SQLAlchemy), and Jinja2, its tech spans more than a few years old. While it works really well for now, it is becoming increasingly harder to deploy to more modern hardware/software (such as Ubuntu 19) to ensure easy setup.

The intent will to be provide similar functionality with the use of NodeJS and Express, and this API will take care of session authentication as well, via the use of `passport-steam`, and rcon server commands via `rcon-srcds`, as well as more normalization in the database.

## Building
In order to build this application, I've opted to use [Yarn](https://yarnpkg.com/lang/en/).

First you will need to copy over the ```development.json.template``` and update any values that are required. These include server values, and database passwords and connections.

If you wish to roll a production build, please copy ```production.json.template``` and fill out all the values.

### Migrate dev database: 
```yarn migrate-dev-upgrade```

You can specify which database to use in the `development.json` area. *Please note that this will delete and recreate the development table.* Also note that there are some tables that have changed. I've opted to normalizing the spectators and team authentication values, as BLOBS were not playing nicely with Node. My current fork deals with inserting into these tables, so I hope that it will eventually be a smooth transition where you can keep all your data from the old Flask app.

### Migrate production database:
```yarn migrate-prod-upgrade```

This will attempt to update a production database by creating any tables that don't exist. It will not drop the database prior to importing new tables.

### Install redis/mysql/node
Redis is required as a session store when running, to aid with persisting user authentication, even if the app goes down. 

#### Ubuntu/Debian
It's preferable to use node version manager (nvm) to control node installations. It makes it easier to swap between projects.

```curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash```

After installation

```nvm install 13.8.0; sudo apt update && sudo apt install mariadb-server redis-server```

Either mysql or mariadb is acceptable. Please start the database server once it is ready:

```sudo service mariadb start; sudo service mariadb enable```.

Once running, please run the secure installation, then create a get5 user after logging in:

```CREATE USER 'get5'@'localhost' IDENTIFIED BY 'sup3r_s3cUr3_p4ssw0rD'; GRANT ALL PRIVILEGES ON get5test.* TO 'get5'@'localhost'; GRANT ALL PRIVILEGES ON get5.* TO 'get5'@'localhost';```

#### CentOS
```curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash```

After installation of nvm either close the terminal or run `source ~/.bashrc`.

```nvm install 13.8.0; sudo yum update && sudo yum install redis mariadb-server```

Either mysql or mariadb is acceptable. Please start the database server once it is ready:

```sudo systemctl start mariadb; sudo systemctl enable mariadb```.

Once running, please run the secure installation, then create a get5 user after logging in:

```CREATE USER 'get5'@'localhost' IDENTIFIED BY 'sup3r_s3cUr3_p4ssw0rD'; GRANT ALL PRIVILEGES ON get5test.* TO 'get5'@'localhost'; GRANT ALL PRIVILEGES ON get5.* TO 'get5'@'localhost';```

#### After Installation
After that's done, please run the configuration for each given database application, and provide the same username/password that you setup with the mariadb setup. Your redis installation should also include a password, and this can be shown how to do that [here](https://stackoverflow.com/a/17018369).

### Build and run: 
```yarn start``` 

Spins up a development server where you can make all your calls. Since steam authentication is enabled, you will need to auth with steam first before making any calls.

### Docs: 
```yarn doc```

This will generate all the API information that I've created in the app, in the hopes of making it more readable and easier to pickup for anyone who wants to try more implementation, or even creating a front-end for this API.

### Coverage Tests
Steam OAuth will be mocked in order to check if a user is "logged in", and create a temporary database (`get5test`) that will insert new values, and check various features of routes. If you wish to alter the "user" it authenticates as, you can edit `utility/mockProfile.js` to the values you prefer.

```yarn test```

Will *require* `test.json` to exist in projects `config` folder, as well as a `super_admin` value that is identical to that in the `mockProfile.js` in the `utility` folder. This ID will get removed from the devleopment config every `yarn test` call, as it requires super admin to test a few API calls.

## Contribution
Sure! If you have a knack for APIs and a penchant for JavaScript, I could always use help! Create a fork of this application, make your changes, and submit a PR. I will be using the [Issues](https://github.com/g5api/issues) page to track what calls still need to be completed. This project won't be finished anytime soon, as I would like to make sure there is a proper handle on authentication with the API, as well as proper security implemented to prevent any unwanted uses with the application. 

If you so choose to contribute, please make sure you include documentation for the API calls, as it is how I am keeping track of all the functionality. I'm using [JSDoc](https://devdocs.io/jsdoc/) to provide documentation, which will eventually be moved over to a wiki.

# License
This project is licensed under [MIT License](http://opensource.org/licenses/MIT). A copy of this license **must be included with the software**.
