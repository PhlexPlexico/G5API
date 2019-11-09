# G5API - API Backend for Get5
_**Status: Early Alpha.**_

G5API is going to be a replacement for the get5-webpanel. _Currently_ this is the backend only, as it will allow the plugin to interface with a database, as well as make various calls to functionality that is seen in the [get5-webpanel](https://github.com/phlexplexico/get5-webpanel)


## What does it do?
Currently, nothing. Right now, this is a very early build to try my hand at using Express as a middleware, and try some JavaScript technologies so that others may create their own front-end applications, with all the difficult back-end stuff being completed. 

As it stands, this API provides no security for the basic CRUD operations for the tables, however the API calls received from the plugin should work, and they are found under the `legacy` folder in `routes`.


## Why?
[Get5-webpanel](https://github.com/phlexplexico/get5-webpanel) is a rather now out-dated webpanel. Being built all on Flask, with ORM (SQLAlchemy), and Jinja2, its tech spans a few years old. While it works really well for now, it is becoming increasingly harder to deploy to more modern hardware (such as Ubuntu 19). With Python2 now being outdated in 2020, it makes sense to move that project over to something newer.

The intent will to be provide similar functionality with the use of NodeJS and express, with still allowing users to authenticate whichever way they wish to implement on the front-end, so long as it abides by using [JWTs](https://jwt.io/). However, the database still requires a steam ID, but it would allow you to create a front-end that requires user sign-in with one, or allow a user to enter one.

## Building
In order to build this application, I've opted to use [Yarn](https://yarnpkg.com/lang/en/).

Build and run: ```yarn start```

Docs: ```yarn doc```

Coverage Tests (will require `development.json` to exist in projects `config` folder): ```yarn test```

## Contribution
Sure! If you have a knack for APIs and a penchant for JavaScript, I could always use help! Create a fork of this application, make your changes, and submit a PR. I will be using the [Issues](https://github.com/g5api/issues) page to track what calls still need to be completed. This project won't be finished anytime soon, as I would like to make sure there is a proper handle on authentication with the API, as well as proper security implemented to prevent any unwanted uses with the application. 

If you so choose to contribute, please make sure you include documentation for the API calls, as it is how I am keeping track of all the functionality. I'm using [JSDoc](https://devdocs.io/jsdoc/) to provide documentation, which will eventually be moved over to a wiki.

# License
This project is licensed under [MIT License](http://opensource.org/licenses/MIT). A copy of this license **must be included with the software**.
