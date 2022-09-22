const GitHubStrategy = require('passport-github2').Strategy;
const {MongoClient, ServerApiVersion} = require('mongodb');
const session = require('express-session');
const passport = require('passport');
const express = require('express')
const {response} = require("express");
const {v4: uuidv4} = require("uuid");
const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@a3-assignment.o7vkxfj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1});
const app = express()
const port = 3000
let collection = null
require('dotenv').config()

const appdata = {
    summary: {
        averageTimeAsleep: 0,
        averageSleepRating: 0,
        dreamPercentage: 0,
        numberOfRecords: 0
    },
    sleepData: {}
}

// await client.connect()

passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (user, done) {
    done(null, user);
});

passport.use(new GitHubStrategy({
    clientID: process.env.GH_CLIENT_ID,
    clientSecret: process.env.GH_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/callback"
}, function (accessToken, refreshToken, profile, done) {
    return done(null, profile);
}));

app.use(session({
    secret: 'sadf;lkjsdflkjas;dlkjnvjkeiruf', resave: false, saveUninitialized: true
}))

app.use(express.static('public'));
// app.use(express.urlencoded({extended: true}))
app.use(express.json())

const isLoggedIn = (req, res, next) => {
    if (req.user) {
        next();
    } else {
        res.redirect('/auth/github')
    }
}

app.use(passport.initialize());

app.use(passport.session());

app.get('/auth/error', (req, res) => res.send('Unknown Error'))

app.get('/auth/github', passport.authenticate('github', {scope: ['user:email']}));

app.get('/auth/github/callback', passport.authenticate('github', {failureRedirect: '/auth/error'}), function (req, res) {
    res.redirect('/');
});

app.get('/', isLoggedIn, (req, res) => {
    console.log(req.user)
    res.sendFile(__dirname + '/protected/index.html');
})

app.get('/test', (req, res) => {
    console.log(req.user)
    res.sendFile(__dirname + '/protected/index2.html');
})

app.get('/getData', (req, res) => {
    res.json(appdata);
})

app.post('/submit', (req, res) => {
    const data = req.body;
    const summary = appdata.summary;
    console.log(req.body);
    const bedTime = new Date(data.timeSleep);
    const timeAwake = new Date(data.timeWakeUp);
    const hoursSlept = getHoursDiff(bedTime, timeAwake);

    summary.numberOfRecords++;

    const averageTimeAsleepChange = (hoursSlept - summary.averageTimeAsleep) / summary.numberOfRecords;
    const averageSleepRatingChange = (data.sleepRating - summary.averageSleepRating) / summary.numberOfRecords;
    const dreamPercentageChange = (data.hadDream - summary.dreamPercentage) / summary.numberOfRecords;

    summary.averageTimeAsleep += averageTimeAsleepChange;
    summary.averageSleepRating += averageSleepRatingChange;
    summary.dreamPercentage += dreamPercentageChange;

    data.id = uuidv4();
    data.hoursSlept = hoursSlept;
    appdata.sleepData[data.id] = data;
    console.log(summary)
    res.json({summary: summary, id: data.id});
})

app.delete('/deleteEntry', (req, res) => {
    const data = req.body;
    const summary = appdata.summary;
    const sleepData = appdata.sleepData;
    if(Object.hasOwn(sleepData, data.id)) {
        summary.numberOfRecords--;
        delete sleepData[data.id];
    }

    if(summary.numberOfRecords > 0) {
        let totalHoursSlept = 0;
        let totalSleepRating = 0;
        let totalDreamPercentage = 0;
        for (const record of Object.values(sleepData)) {
            totalHoursSlept += record.hoursSlept;
            totalSleepRating += record.sleepRating;
            totalDreamPercentage += record.hadDream;
        }
        summary.averageTimeAsleep = totalHoursSlept / summary.numberOfRecords;
        summary.averageSleepRating = totalSleepRating / summary.numberOfRecords;
        summary.dreamPercentage = totalDreamPercentage / summary.numberOfRecords;
    } else {
        summary.averageTimeAsleep = 0;
        summary.averageSleepRating = 0;
        summary.dreamPercentage = 0;
    }

    response.send(summary);
})

const getHoursDiff = function (startDate, endDate) {
    const msInHour = 1000 * 60 * 60;
    return Number((Math.abs(endDate - startDate) / msInHour).toFixed(2));
}

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})