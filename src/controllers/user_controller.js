/* eslint-disable consistent-return */
/* eslint-disable prefer-destructuring */
import jwt from 'jwt-simple';
import dotenv from 'dotenv';
import axios from 'axios';
import User from '../models/user_model';
import { LocationModel } from '../models/location_model';

dotenv.config({ silent: true });

const createUser = (req, res, next) => {
  const { userID, initialUploadData } = req.body; // userID obtained from firebase sign in w. Google

  if (!userID) {
    return res.status(422).send('You must provide the firebase userID');
  }

  User.findOne({ _id: userID })
    .then((foundUser) => {
      if (foundUser === null) {
        const user = new User();

        user._id = userID;
        user.initialUploadData = initialUploadData;

        user.save()
          .then((response) => { // if save is successfull
            res.send({ token: tokenForUser(user), response });
          })
          .catch((error) => { // if save throws an error
            if (error) {
              res.sendStatus(500);
            }
          });
      } else { // if founderUser !== null
        console.log('A user with this firebase userID already exists! Sending the info...');
        res.send(foundUser);
      }
    }) // end of .then
    .catch((err) => {
      res.sendStatus(500);
    });
};

// makes google maps reverse geocoding api call with lat long input, returns an address if promise is resolved
const getLocationInfo = (coords) => {
  const coordList = coords.split(',');
  coordList[0] = coordList[0].replace(/^\s+|\s+$/g, '');
  coordList[1] = coordList[1].replace(/^\s+|\s+$/g, '');

  return new Promise((resolve, reject) => {
    axios
      .get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordList[0]},${coordList[1]}&key=${process.env.GOOGLE_API_KEY}`,
      )
      .then((result) => {
        if (result.data.results.length > 0) {
          const locationData = {
            formatted_address: result.data.results[0].formatted_address || '',
            place_id: result.data.results[0].place_id || '',
            types: result.data.results[0].types.length > 0 ? result.data.results[0].types[0] : '',
          };
          resolve(locationData);
        } else {
          resolve({});
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
};

// convert lat longs for each location object of a user to actual google places
const setGoogleLocationInfo = (uid) => {
  User.findOne({ _id: uid })
    .then((foundUser) => {
      if (foundUser === null) {
        console.error(`Didn't find user with id: ${uid}`);
      } else {
        const promises = [];
        const locationsObserved = [];
        const discoveredLocations = {};
        let times = 0;

        // grab location info for each location
        foundUser.frequentLocations.forEach((locationObj) => {
          promises.push(new Promise((resolve, reject) => {
            // ensure we don't already have info on this location
            if (locationObj.location === undefined) {
              // if we haven't come across this location already, hit google api and store
              if (!locationsObserved.includes(locationObj.latLongLocation)) {
                locationsObserved.push(locationObj.latLongLocation);
                times += 1;

                // make a call to google api to get info
                getLocationInfo(locationObj.latLongLocation)
                  .then((result) => {
                    locationObj.location = result;

                    // cache the result to grab after the promises resolve
                    discoveredLocations[locationObj.latLongLocation] = result;
                    resolve(locationObj);
                  })
                  .catch((error) => {
                    resolve();
                  });
              }

              // if we have come across this lat long before, we won't have gotten the google data in time because it's an async call
              // so, just mark that we know we need to fill this in
              else {
                locationObj.location = {};
                resolve(locationObj);
              }
            }
          }));
        });

        // when all location objects have been searched by google or stored, check for the ones we passed on
        Promise.all(promises).then(() => {
          const confirmPromises = [];

          // loop over each location and object and check if we passed on making an API call but had to wait to access the data
          foundUser.frequentLocations.forEach((locationObj) => {
            confirmPromises.push(new Promise((resolve, reject) => {
              // if this location has an empty location field and we know we stored it's google info, set it
              if (Object.keys(locationObj).length === 0 && Object.keys(discoveredLocations).contains(locationObj.latLongLocation)) {
                locationObj.location = discoveredLocations[locationObj.latLongLocation];
              }
              resolve();
            }));
          });

          // once we've gotten all location points, save the user and return
          Promise.all(confirmPromises)
            .then(() => {
              foundUser.save()
                .then((result) => {
                  console.log('DONE');
                  console.log(times);
                })
                .catch((error) => {
                  console.error(error);
                });
            })
            .catch((error) => {
              console.log(error);
            });
        });
      }
    }) // end of .then
    .catch((err) => {
      console.error(err);
    });
};

const setModelRun = (req, res, modelOutput) => {
  const { uid } = req.body; // userID obtained from firebase sign in w. Google

  if (!uid) {
    return res.status(422).send('You must provide the firebase userID');
  }

  User.findOne({ _id: uid })
    .then((foundUser) => {
      if (foundUser === null) {
        res.status(500).send(`No user exists with id: ${uid}`);
      } else {
        const output = [];

        const locationPromises = [];

        // for each location we observed
        modelOutput.forEach((entry) => {
          // for each sitting we observed at that location
          entry[Object.keys(entry)[0]].forEach((sitting) => {
            // wrap in promise because .save() is async
            locationPromises.push(new Promise((resolve, reject) => {
              // create a location object for this sitting at this location
              const locationObj = new LocationModel();
              locationObj.latLongLocation = Object.keys(entry)[0];
              locationObj.startTime = parseInt(sitting.startTime, 10);
              locationObj.endTime = parseInt(sitting.endTime, 10);

              // productivity is null, can search on user, frequent locations .find({ productivity: null })

              // save location object, then append to frequentLocations array and resolve promise
              locationObj.save().then(() => {
                output.push(locationObj);
                resolve();
              }).catch((err) => {
                reject(err);
              });
            }));
          });
        });

        // when all location objects for this user are created, save this user and send to res
        Promise.all(locationPromises).then(() => {
          foundUser.frequentLocations = output;
          foundUser.save().then(() => {
            // grab location details from google api -- run in background and confirm success to user
            setGoogleLocationInfo(req.body.uid);
            res.send({ message: 'success!' });
          }).catch((err) => {
            res.status(500).send(err);
          });
        });
      }
    }) // end of .then
    .catch((err) => {
      res.status(500).send(err);
    });
};

// encodes a new token for a user object
function tokenForUser(user) {
  const timestamp = new Date().getTime();
  return jwt.encode({ sub: user.id, iat: timestamp }, process.env.AUTH_SECRET);
}

export { createUser, setModelRun };
