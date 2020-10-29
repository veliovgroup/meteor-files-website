# Deploy to Heroku

- Due to "*ephemeral filesystem*" on Heroku, we suggest to use 3rd-party permanent storage, [read DropBox/S3/GridFS tutorial](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage)
- Go to [Heroku](https://signup.heroku.com/dc) create and confirm your new account
- Go through [Node.js Tutorial](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
- Install [Heroku Toolbet](https://devcenter.heroku.com/articles/getting-started-with-nodejs#set-up)
- Then go to Terminal into Meteor's project directory and run:

```shell
# Build meteor app from https://github.com/VeliovGroup/meteor-files-website
# Available architectures:
# os.osx.x86_64
# os.linux.x86_64
# os.linux.x86_32
# os.windows.x86_32
meteor build ../build-<your-app-name> --architecture os.linux.x86_64
cd ../build-<your-app-name>
tar xzf <name-of-archive> -C ./
cd bundle/
cp -Rf * ../
cd ../
rm -Rf bundle/
rm -Rf <name-of-archive>
touch Procfile
echo "web: node main.js" > Procfile

heroku create <your-app-name> --buildpack https://github.com/heroku/heroku-buildpack-nodejs
# This command will output something like:
# - https://<your-app-name>.herokuapp.com/
# - https://git.heroku.com/<your-app-name>.git

# ONLY FOR CEDAR <= 14 - Add GraphicsMagick buildpack - for image manipulations
heroku buildpacks:add --index 1 https://github.com/mcollina/heroku-buildpack-graphicsmagick.git

# FOR CEDAR >= 16 - Add APT buildpack - to install graphicksmagick
heroku buildpacks:add --index 1 https://github.com/heroku/heroku-buildpack-apt

git init
heroku git:remote -a <your-app-name>

# Copy this: `https://<your-app-name>.herokuapp.com`, note `http(s)://` protocol
heroku config:set ROOT_URL=https://<your-app-name>.herokuapp.com
# To have a MongoDB, you can create one at https://mlab.com/
# After creating MongoDB instance create user, then copy URL to your MongoDB
# Should be something like: mongodb://<dbuser>:<dbpassword>@dt754268.mlab.com:19470/mydb
heroku config:set MONGO_URL=mongodb://<dbuser>:<dbpassword>@dt754268.mlab.com:19470/mydb

# For AWS:S3:
# heroku config:set S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx"}}'

# Enable sticky sessions, to support HTTP upload:
heroku features:enable http-session-affinity

git add .
git commit -m "initial"
git push heroku master
```

- Go to `https://<your-app-name>.herokuapp.com`
- If your app has errors:
  - Check logs: `heroku logs --tail`
  - Try to run locally and debug: `heroku run node`
