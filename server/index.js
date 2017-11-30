const express = require('express');
const bodyParser = require('body-parser');
const isoCode = require('../client/src/utils/weatherHelper.js');
const request = require('request');
const session = require('express-session')
const rp = require('request-promise');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const Promise = require('bluebird');
const itemsHelper = require('../database/itemsHelpers');
const tripsHelper = require('../database/tripsHelpers');

// FILL IN DATABASE FILE --> 
const database = require('../database/index.js');
const path = require('path');
const pg = require('pg');
const port = process.env.PORT || 3000;
const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({ extended: false });

//google OAuth using passport
passport.use(new GoogleStrategy(
  {
    clientID: '',
    clientSecret: '',
    callbackURL: 'http://localhost:3000/auth/google/callback',
    passReqToCallBack: true,
  },
  ((accessToken, refreshToken, profile, done) => {
    database.createUser(profile.emails[0].value, profile.name.givenName, profile.name.familyName, profile.id.toString()).then(() => {
    done(null, profile);
    });
  })
));
//middleware that checks to see if a user has signed in before allowing them to access certain pages. 
const isAuthenticated =  (req, res, next) =>{
  if(req.isAuthenticated()){
    return next();
  }
  res.redirect('/login');
}

const app = express();
app.use(session({ secret: 'anything', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, '/../client/dist')));
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());

passport.serializeUser((user, done) => {
  console.log('serialize User');
  done(null, user.id);
});

passport.deserializeUser(function(id, done){
  return new Promise((resolve, reject) => {
  console.log('deserialize user');
  resolve(database.findUser(id))
  }).then((user) => {
  done(null, user.dataValues);
  });
});

//returns a bool to see if a user is loggedin or not
app.get('/check', (req, res) => {
  if(req.isAuthenticated()){
    res.send(true);
  } else {
  res.send(false);
  }
});

// App pages

app.get('/', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '/../client/dist/index.html'));
});

app.get('/trip', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '/../client/dist/index.html'));
});
app.get('/trip#', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '/../client/dist/index.html'));
});

app.get('/login', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '/../client/dist/index.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '/../client/dist/index.html'));
});

app.get('/home', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '/../client/dist/index.html'));
});

//redirects to google auth page
app.get('/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

//redirects to /dashboard on successful login 
app.get('/auth/google/callback',
  passport.authenticate('google', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
  })
);

//gets user and sends it back to wherever this is called
app.get('/user', (req, res) => {
  console.log('user', req.user.googleId);
  database.findUser(req.user.googleId).then((user) => {
    (res.send(user));
  });
});



// API Endpoints

app.get('/users/:userId/trips', (req, res) => {
  tripsHelper.getTrips(req.params.userId)
    .then((results) => {
      res.send(results);
    });
});

app.post('/trips', (req, res) => {
  tripsHelper.add(req.body)
    .then((results) => {
      res.send({ id: results });
    });
});

app.post('/trips/items', (req, res) => {
  tripsHelper.addItemsToTrip(req.body)
    .then(() => {
      res.sendStatus(201);
    });
});


app.post('/items', (req, res) => {
  itemsHelper.add(req.body)
    .then((results) => {
      res.send(results);
    });
});

app.get('/users/:userId/items', (req, res) => {
  itemsHelper.getUserItems(req.user.id)
    .then((results) => {
      res.send(results);
    });
});

app.get('/trips/:tripId/items', (req, res) => {
  itemsHelper.getTripItems(req.params.tripId)
    .then((results) => {
      res.send(results);
    });
});


app.patch('/trip/items/:id/packed', (req, res) => {
  itemsHelper.updatePacked(req.params.id)
    .then(() => {
      res.sendStatus(201);
    });
});

app.delete('/trip/items/:id', (req, res) => {
  itemsHelper.deleteTripItem(req.params.id)
    .then(() => {
      res.sendStatus(200);
    });
});

app.patch('/trip/items/:id', (req, res) => {
  itemsHelper.editTripItem(req.body)
    .then(() => {
      res.sendStatus(200);
    });
});

//gets historical weather from worldbank API. Searches by country. Dashboard will need to collect both city and country in order to call both. 
app.get('/weather/', (req, res) => {
  const tripStart = '20170827';
  const tripEnd = '20170905';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return isoCode.isoCode('france').then((result) => {
    const startMonth = Number(tripStart.slice(4, 6)) - 1;
    const endMonth = Number(tripEnd.slice(4, 6)) - 1;
    const rendered = [[months[startMonth], result[startMonth]], [months[endMonth], result[endMonth]]];
    res.body = JSON.stringify(rendered);
    res.send(res.body);
  });
});

//gets current weather from weather underground. Will need to be fixed depending on city
app.get('/forecast/', (req, res) => {
  const options = {
    type: 'GET',
    uri: 'http://api.wunderground.com/api/1acaa967ad91ec5b/forecast10day/q/CA/San_Francisco.json',
  };
  rp(options).then(result => result).then((result) => {
    res.body = result;
    res.send(res.body);
  });
});

app.listen(port, () => {
  console.log(`Server running at port:${port}`);
});

