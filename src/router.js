import { Router } from 'express';
import { Map } from 'immutable';
import * as firebase from 'firebase';
import * as Users from './controllers/user_controller';
import { requireSignin } from './services/passport';
// import { requireAuth } from './services/passport';

// import firebase configuration
const FireBaseConfig = {
  apiKey: process.env.firebase_apiKey,
  authDomain: process.env.firebase_authDomain,
  databaseURL: process.env.firebase_databaseURL,
  projectId: process.env.firebase_projectId,
  storageBucket: process.env.firebase_storageBucket,
  messagingSenderId: process.env.firebase_messagingSenderId,
};

// initialize firebase
if (!firebase.apps.length) {
  firebase.initializeApp(FireBaseConfig);
}

const router = Router();

// subtract numMinutes from timestamp in epoch
const subtractMinutes = (timestamp, numMinutes) => {
  return timestamp - (numMinutes * 60 * 1000);
};

// taken from: https://www.geodatasource.com/developers/javascript
const computeDistance = (lat1, lon1, lat2, lon2, unit) => {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  } else {
    const radlat1 = (Math.PI * lat1) / 180;
    const radlat2 = (Math.PI * lat2) / 180;
    const theta = lon1 - lon2;
    const radtheta = (Math.PI * theta) / 180;
    let dist = Math.sin(radlat1) * Math.sin(radlat2)
          + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = (dist * 180) / Math.PI;
    dist = dist * 60 * 1.1515;
    if (unit === 'K') {
      dist *= 1.609344;
    }
    if (unit === 'N') {
      dist *= 0.8684;
    }
    return dist;
  }
};

router.post('/getAuth', (req, res, next) => {
  Users.createUser(req, res, next);
});

router.post('/uploadGoogleLocationData', (req, res) => {
  const { locations } = req.body;

  // clump together time observation sittings
  const sittings = [];

  // define helper variables
  let currentStartTime;
  let currentEndTime;
  let currentLatitude;
  let currentLongitude;

  const promises = [];

  // find sittings from all location data
  locations.forEach((observation) => {
    promises.push(new Promise((resolve, reject) => {
      // if we don't have data on our currents, set and move on
      if (!currentStartTime) {
        currentStartTime = observation.timestampMs;
        currentEndTime = observation.timestampMs;
        currentLatitude = observation.latitudeE7 / (10 ** 7);
        currentLongitude = observation.longitudeE7 / (10 ** 7);
        resolve();
      }

      // if the observation is within 0.1 miles of the current location
      else if (computeDistance(currentLatitude, currentLongitude, observation.latitudeE7 / (10 ** 7), observation.longitudeE7 / (10 ** 7), 'M') < 0.1) {
        currentEndTime = observation.timestampMs;
        resolve();
      }

      // found a new location/sitting so we need to save this sitting and advance
      else if (currentStartTime < subtractMinutes(currentEndTime, 15)) {
        sittings.push({
          startTime: currentStartTime,
          endTime: currentEndTime,
          latitude: currentLatitude,
          longitude: currentLongitude,
        });

        currentStartTime = observation.timestampMs;
        currentEndTime = observation.timestampMs;
        currentLatitude = observation.latitudeE7 / (10 ** 7);
        currentLongitude = observation.longitudeE7 / (10 ** 7);
        resolve();
      }

      else {
        currentStartTime = observation.timestampMs;
        currentEndTime = observation.timestampMs;
        currentLatitude = observation.latitudeE7 / (10 ** 7);
        currentLongitude = observation.longitudeE7 / (10 ** 7);
        resolve();
      }
    }));
  });

  // once all observations have been clumped to sittings, group by common areas
  Promise.all(promises).then(() => {
    let commonLocations = new Map();
    const sittingPromises = [];

    sittings.forEach((sitting) => {
      sittingPromises.push(new Promise((resolve, reject) => {
        let foundKey = false;

        commonLocations.keySeq().forEach((key) => {
          if (!foundKey && computeDistance(sitting.latitude, sitting.longitude, key.latitude, key.longitude, 'M') < 0.1) {
            commonLocations.get(key).push({ startTime: sitting.startTime, endTime: sitting.endTime });
            foundKey = true;
            resolve();
          }
        });

        if (!foundKey) {
          const sittingArray = [];
          sittingArray.push({
            startTime: sitting.startTime,
            endTime: sitting.endTime,
          });

          commonLocations = commonLocations.set({
            latitude: sitting.latitude,
            longitude: sitting.longitude,
          }, sittingArray);

          resolve();
        }
      }));
    });

    // once all groups have been formed, set an output json object to store/send to user
    Promise.all(sittingPromises).then(() => {
      const outputPromises = [];
      const output = [];

      commonLocations.entrySeq().forEach(([key, value]) => {
        if (value.length >= 2) {
          outputPromises.push(new Promise((resolve, reject) => {
            const newObj = {};
            newObj[`${key.latitude.toString()} , ${key.longitude.toString()}`] = value;
            output.push(newObj);
            resolve();
          }));
        }
      });

      // final result to send to user -- should store this in db
      Promise.all(outputPromises).then(() => {
        res.send(output);
      });
    });
  });
});

// router.route('/posts')
//   .post(requireAuth, Posts.createPost)
//   .get((req, res) => {
//     Posts.getPosts(req, res);
//   });

// router.route('/posts/:id')
//   .get((req, res) => {
//     Posts.getPost(req, res);
//   })
//   .put(requireAuth, Posts.updatePost)
//   .delete(requireAuth, Posts.deletePost);

router.post('/signin', requireSignin, Users.signin);

router.post('/signup', Users.signup);

export default router;
