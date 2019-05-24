/* eslint-disable consistent-return */
/* eslint-disable prefer-destructuring */
import jwt from 'jwt-simple';
import dotenv from 'dotenv';
import { Map } from 'immutable';
import User from '../models/user_model';
import { LocationModel } from '../models/location_model';

import { subtractMinutes, computeDistance } from '../constants/distance_time';
import getLocationInfo from '../services/google_api';

dotenv.config({ silent: true });

const moment = require('moment');

// create user object for this id if one doesn't exist already
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
            // TODO: don't send the entire object back (will be huge), just send necessary info
            res.send({ token: tokenForUser(user), response });
          })
          .catch((error) => { // if save throws an error
            if (error) {
              res.sendStatus(500);
            }
          });
      } else { // if founderUser !== null
        console.log('A user with this firebase userID already exists! Sending the info...');

        // TODO: don't send the entire object back (will be huge), just send necessary info
        res.send(foundUser);
      }
    }) // end of .then
    .catch((err) => {
      res.sendStatus(500);
    });
};

export const updateUserSettings = (req, res, next) => {
  const {
    userID, homeLocation, homeLocationLatLong, presetProductiveLocations,
  } = req.body;

  User.findOne({ _id: userID })
    .then((foundUser) => {
      foundUser.homeLocation = homeLocation; // set the home Location appropriately e.g. "Dartmouth Street, Boston, MA,USA"
      foundUser.latlongHomeLocation = homeLocationLatLong; // set the latLong for the user appropriately e.g. "42.3485196, -71.0765708"

      const newPresetProductiveLocations = {}; // create a new Object

      presetProductiveLocations.forEach((location) => { // loop through all the objects sent from the front-end
        const address = location.address;
        newPresetProductiveLocations[address] = location.productivity;
      });

      if (Object.keys(newPresetProductiveLocations).length !== 0) {
        foundUser.presetProductiveLocations = newPresetProductiveLocations;
      }

      // now, go into all the locations of this user and set strings and productivities respectively
      const allPresetProductiveLocationAddresses = [];
      const promises = [];

      foundUser.presetProductiveLocations.forEach((location) => {
        allPresetProductiveLocationAddresses.push(Object.keys(location)[0]);
      });

      foundUser.frequentLocations.forEach((locationObj) => {
        promises.push(new Promise((resolve, reject) => {
          if (allPresetProductiveLocationAddresses.includes(locationObj.location.formatted_address)) {
            if (!locationObj.productivity) {
              const prodLocation = presetProductiveLocations.find((element) => {
                return element.address === locationObj.location.formatted_address;
              });

              locationObj.productivity = prodLocation.productivity;
            }
          }
          resolve();
        }));
      });

      Promise.all(promises)
        .then((results) => {
          // end result should be foundUser.presetProductiveLocations = [ {"9 Maynard Street, Hanover, NH": 5}, {"Dartmouth Street, Boston, MA,USA: 3} ]
          foundUser.save()
            .then((response) => {
              res.send({ message: `Success saving user settings for user with id ${userID}` });
            })
            .catch((err) => {
              if (err) {
                res.status(500).send(`Error upon saving user settings for user with id ${userID}`);
              }
            });
        })
        .catch((error) => {
          res.status(500).send(error);
        });
    })
    .catch((error) => {
      if (error) {
        res.status(500).send(`Error upon saving user settings for user with id ${userID}. Could not find user.`);
      }
    });
};

export const getLocationsWithProductivityNullWithinLastNDays = (req, res, next) => {
  const { userID, days } = req.body;

  // const days = 14; // last 14 days . if days = 7, find all locations w. productivity == null in last 7 days

  User.aggregate([
    { $match: { _id: userID } },
    { $project: { frequentLocations: 1, _id: 0 } }])
    .then((foundLocations, error) => {
      const foundLocations1 = foundLocations[0].frequentLocations;
      const timeStampOfExactlyOneWeekAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).getTime();
      const onlyFilteredLocationObjs = foundLocations1.filter((locationObj) => {
        return locationObj.productivity === undefined && locationObj.startTime >= timeStampOfExactlyOneWeekAgo;
      });

      console.log(timeStampOfExactlyOneWeekAgo);

      console.log(onlyFilteredLocationObjs.length);

      res.send(onlyFilteredLocationObjs);
      // res.send(foundLocations[0].frequentLocations);
    })
    .catch((error) => {
      res.status(500).send(error);
    });

  // { $unwind: '$frequentLocations' },
  // { $match: { productivity: null } },
  // { $limit: 5 }])

  // User.findOne({ _id: userID })
  //   .then((foundUser) => {
  //     // res.send({ message: 'success!' });
  //     res.send(foundUser);
  //     // res.send(foundUser.frequentLocations); // find all its locations. test this in Postman!
  //   })
  //   .catch((error) => {
  //     res.status(500).send(error);
  //   });
};

export const updateProductivityLevel = (req, res, next) => {
  const { userID, productivity } = req.body;
  const { locationID } = req.params;

  console.log('you hit the route!');

  User.findOne({ _id: userID }, { frequentLocations: 1 })
    .then((foundUser) => {
      console.log('you found the user!');

      const foundLocationObj = foundUser.frequentLocations.id(locationID);
      foundLocationObj.productivity = productivity;

      console.log(foundLocationObj);
      // res.send(foundLocationObj);

      console.log('yay!');

      foundUser.save()
        .then((updatedUserandLocationObj) => {
          console.log('Successfully saved!');
        })
        .catch((error) => {
          res.status(500).send('Error on saving the user once location productivity has been updated!');
        });
    })
    .catch((error) => {
      res.status(500).send(error);
    });

  console.log('bump!');

  LocationModel.findOne({ _id: locationID })
    .then((foundLocation) => {
      foundLocation.productivity = productivity;

      foundLocation.save()
        .then((savedfoundLocation) => {
          console.log(`Successfully set the location document with id ${locationID} to have a productivity of ${productivity}`);
          res.send(savedfoundLocation);
        })
        .catch((error) => {
          res.status(500).send(`Error upon saving location document with id ${locationID}`);
        });
    });
};

//   foundUser.frequentLocations.findOne({ _id: locationID })
//     .then((foundLocation) => {
//       console.log('you found the location!');
//       res.send(foundLocation);
//     })
//     .catch((error) => {
//       res.status(500).error('Error on finding User or finding location');
//     });
// })
// .catch((error) => {
//   res.status(500).send(error);
// });

// foundUser.LocationSchema.findOne({ _id: locationID })
// .then((foundLocation) => {
//   console.log('you found the location!');
//   res.send(foundLocation);
// })
// .catch((error) => {
//   res.status(500).error('Error on finding User or finding location');
// });

// LocationModel.findOne({ _id: locationID }) // is this the correct way to query for it...? // also, is LocationModel correct...?
//   .then((foundLocation) => {
//     foundLocation.productivity = productivity;

//     foundLocation.save()
//       .then((savedfoundLocation) => {
//         console.log(`Successfully set the location document with id ${locationID} to have a productivity of ${productivity}`);
//         res.send(savedfoundLocation);
//       })
//       .catch((error) => {
//         res.status(500).send(`Error upon saving location document with id ${locationID}`);
//       });
//   })
//   .catch((error) => {
//     res.status(500).send(error);
//   });

const getSum = (total, num) => {
  return total + num;
};

function dayOfWeekAsString(dayIndex) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
}

export const getMostProductiveWeekDay = (req, res, next) => {
  const { userID } = req.body;

  // const userID = req.body.userID;

  const Sunday = [];
  const Monday = [];
  const Tuesday = [];
  const Wednesday = [];
  const Thursday = [];
  const Friday = [];
  const Saturday = [];

  User.findOne({ _id: userID })
    .then((foundUser) => {
      foundUser.frequentLocations.forEach((locationObj) => {
        const EpochOfSingularLocationObj = locationObj.startTime;
        const ProductivityOfSingularLocationObj = locationObj.productivity;

        if (ProductivityOfSingularLocationObj) {
          const dayOfWeek = moment(EpochOfSingularLocationObj).format('d'); // dayOfWeek is a string

          switch (dayOfWeek)
          {
            case '0':
            // console.log('Sunday');
              Sunday.push(Number(ProductivityOfSingularLocationObj));
              break;
            case '1':
            // console.log('Monday');
              Monday.push(Number(ProductivityOfSingularLocationObj));
              break;
            case '2':
            // console.log('Tuesday');
              Tuesday.push(Number(ProductivityOfSingularLocationObj));
              break;
            case '3':
            // console.log('Wednesday');
              Wednesday.push(Number(ProductivityOfSingularLocationObj));
              break;
            case '4':
            // console.log('Thursday');
              Thursday.push(Number(ProductivityOfSingularLocationObj));
              break;
            case '5':
            // console.log('Friday');
              Friday.push(Number(ProductivityOfSingularLocationObj));
              break;
            default:
            // console.log('Saturday');
              Saturday.push(Number(ProductivityOfSingularLocationObj));
          }
        }
      });

      // CHECK IF ANY OF SUNDAY, MONDAY, TUESDAY, WEDNESDAY ... ETC . , IS NULL

      const sumOfSunday = Sunday.reduce(getSum);
      const sumOfMonday = Monday.reduce(getSum);
      const sumOfTuesday = Tuesday.reduce(getSum);
      const sumOfWednesday = Wednesday.reduce(getSum);
      const sumOfThursday = Thursday.reduce(getSum);
      const sumOfFriday = Friday.reduce(getSum);
      const sumOfSaturday = Saturday.reduce(getSum);

      const avgProductivityofSunday = (sumOfSunday / Sunday.length);
      const avgProductivityofMonday = (sumOfMonday / Monday.length);
      const avgProductivityofTuesday = (sumOfTuesday / Tuesday.length);
      const avgProductivityofWednesday = (sumOfWednesday / Wednesday.length);
      const avgProductivityofThursday = (sumOfThursday / Thursday.length);
      const avgProductivityofFriday = (sumOfFriday / Friday.length);
      const avgProductivityofSaturday = (sumOfSaturday / Saturday.length);

      console.log(avgProductivityofSunday);
      console.log(avgProductivityofMonday);
      console.log(avgProductivityofTuesday);
      console.log(avgProductivityofWednesday);
      console.log(avgProductivityofThursday);
      console.log(avgProductivityofFriday);
      console.log(avgProductivityofSaturday);

      const highestAvgProductivity = Math.max(avgProductivityofSunday, avgProductivityofMonday, avgProductivityofTuesday, avgProductivityofWednesday, avgProductivityofThursday, avgProductivityofFriday, avgProductivityofSaturday);

      console.log('The highest avg Productivity is: ');
      console.log(highestAvgProductivity);

      let mostProductivityWeekDay = 6;

      switch (highestAvgProductivity)
      {
        case (avgProductivityofSunday):
          mostProductivityWeekDay = 0;
          break;
        case (avgProductivityofMonday):
          mostProductivityWeekDay = 1;
          break;
        case (avgProductivityofTuesday):
          mostProductivityWeekDay = 2;
          break;
        case (avgProductivityofWednesday):
          mostProductivityWeekDay = 3;
          break;
        case (avgProductivityofThursday):
          mostProductivityWeekDay = 4;
          break;
        case (avgProductivityofFriday):
          mostProductivityWeekDay = 5;
          break;
        default:
          mostProductivityWeekDay = 6;
      }

      console.log('Your most productive weekDay is: ');
      console.log(mostProductivityWeekDay);

      const mostProductivityWeekDayString = dayOfWeekAsString(mostProductivityWeekDay);

      // const mostProductivityWeekDayString = moment('5').format('dddd');

      console.log(mostProductivityWeekDayString);

      // console.log('The length of your Sunday [] is: ');
      // console.log(Sunday.length);

      // console.log('The length of your Monday [] is: ');
      // console.log(Monday.length);

      // console.log('The length of your Tuesday [] is: ');
      // console.log(Tuesday.length);

      // console.log('The length of your Wednesday [] is: ');
      // console.log(Wednesday.length);

      // console.log('The length of your Thursday [] is: ');
      // console.log(Thursday.length);

      // console.log('The length of your Friday [] is: ');
      // console.log(Friday.length);

      // console.log('The length of your Saturday [] is: ');
      // console.log(Saturday.length);

      // console.log(foundUser.frequentLocations[0].startTime);

      // const EpochOfSingularLocation = foundUser.frequentLocations[0].startTime;
      // const ProductivityOfSingularLocation = foundUser.frequentLocations[0].productivity;

      // console.log('The productivity of your singular locationObj is: ');
      // console.log(ProductivityOfSingularLocation);

      // const dayOfWeek = moment(EpochOfSingularLocation).format('d'); // dayOfWeek is a string


      // switch (dayOfWeek)
      // {
      //   case '0':
      //     console.log('Sunday');
      //     Sunday.push(ProductivityOfSingularLocation);
      //     break;
      //   case '1':
      //     console.log('Monday');
      //     Monday.push(ProductivityOfSingularLocation);
      //     break;
      //   case '2':
      //     console.log('Tuesday');
      //     Tuesday.push(ProductivityOfSingularLocation);
      //     break;
      //   case '3':
      //     console.log('Wednesday');
      //     Wednesday.push(ProductivityOfSingularLocation);
      //     break;
      //   case '4':
      //     console.log('Thursday');
      //     Thursday.push(ProductivityOfSingularLocation);
      //     break;
      //   case '5':
      //     console.log('Friday');
      //     Friday.push(ProductivityOfSingularLocation);
      //     break;
      //   default:
      //     console.log('Saturday');
      //     Saturday.push(ProductivityOfSingularLocation);
      // }

      // console.log('Your formatted timestamp day of week is: ');
      // console.log(dayOfWeek);

      // console.log('The length of your Monday [] is: ');
      // console.log(Monday.length);

      // res.send({ EpochOfSingularLocation });

      res.send({ message: 'success!' });
    })
    .catch((error) => {
      res.status(500).send(error);
    });
};

// convert lat longs for each location object of a user from their background location to actual google places
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
            if (Object.keys(locationObj.location).length === 0) {
              // if we haven't come across this location already, either check other location objects or the google api for more info
              if (!locationsObserved.includes(locationObj.latLongLocation)) {
                // mark that we will soon know more about this location, so other location objects here can wait to get the information
                locationsObserved.push(locationObj.latLongLocation);

                // check if any pre-existing location in our model knows about this location
                LocationModel.find({ latLongLocation: locationObj.latLongLocation })
                  .then((foundLocations) => {
                    // ensure we got data
                    if (foundLocations.length > 0) {
                      let foundInfo = false;

                      const foundPromises = [];

                      // check each location object
                      foundLocations.forEach((foundLocation) => {
                        foundPromises.push(new Promise((resolve, reject) => {
                          if (foundLocation !== null) {
                            // make sure this location object has google data in it
                            if (foundLocation.location !== null && foundLocation.location !== undefined) {
                              if (Object.keys(foundLocation.location).length > 0) {
                                // store result in object
                                locationObj.location = foundLocation.location;

                                // cache the result to grab after the promises resolve
                                discoveredLocations[locationObj.latLongLocation] = foundLocation.location;
                                foundInfo = true;
                                resolve(locationObj);
                              }
                            } else {
                              foundLocation.location = {};
                              resolve(locationObj);
                            }
                          }
                        }));
                      });

                      Promise.all(foundPromises)
                        .then((results) => {
                          // if none of these objects had info on this location, make a call to the google api
                          if (!foundInfo) {
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
                        })
                        .catch((error) => {
                          locationObj.location = {};
                          resolve(locationObj);
                        });

                      // if not, make a call to the google api
                    } else {
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
                  })
                  .catch((error) => {
                    console.error(error);
                  });
              }

              // if we have come across this lat long before, we won't have gotten the google data in time because it's an async call
              // so, just mark that we know we need to fill this in
              else {
                locationObj.location = {};
                resolve(locationObj);
              }
            } else {
              resolve(locationObj);
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

// store background data from user in temporary waiting pool
const storeBackgroundData = (req, res, next) => {
  const { uid, dataToBeProcessed } = req.body; // userID obtained from firebase sign in w. Google

  if (!uid) {
    return res.status(422).send('You must provide the firebase userID');
  }

  User.findOne({ _id: uid })
    .then((foundUser) => {
      // make sure the field exists
      if (foundUser.backgroundLocationDataToBeProcessed === undefined || foundUser.backgroundLocationDataToBeProcessed === null) {
        foundUser.backgroundLocationDataToBeProcessed = [];
      }

      // store all data
      dataToBeProcessed.forEach((element) => {
        foundUser.backgroundLocationDataToBeProcessed.push(element);
      });

      // save object
      foundUser.save()
        .then((user) => {
          res.send({ message: 'success' });
        })
        .catch((error) => {
          res.status(500).send(error);
        });
    })
    .catch((error) => {
      res.status(500).send(error);
    });
};

// add data processed from background location to user's frequentLocations array
const addToFrequentLocations = (uid, dataToBeProcessed) => {
  User.findOne({ _id: uid })
    .then((foundUser) => {
      if (foundUser === null) {
        console.error(`No user with uid: ${uid}`);
      } else {
        const output = [];
        const locationPromises = [];

        // for each location we observed
        dataToBeProcessed.forEach((entry) => {
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

        // when all location objects for this user are created, store the location data
        Promise.all(locationPromises).then(() => {
          const storePromises = [];

          output.forEach((object) => {
            storePromises.push(new Promise((resolve, reject) => {
              foundUser.frequentLocations.push(object);
              resolve();
            }));
          });

          // when all info is stored in the user, save user and ensure all location data has google info
          Promise.all(storePromises)
            .then(() => {
              foundUser.save().then(() => {
                // grab location details from google api
                setGoogleLocationInfo(uid);
              }).catch((err) => {
                console.error(err);
              });
            })
            .catch((error) => {
              console.error(error);
            });
        });
      }
    }) // end of .then
    .catch((err) => {
      console.error(err);
    });
};

// ROBBIE: CALL THIS FUNCTION EACH NIGHT AT 7PM TO PROCESS THE WAITING DATA IN THE USER'S POOL

// go through a user's background location data and add to their frequent locations
const processBackgroundLocationData = (uid) => {
  User.findOne({ _id: uid })
    .then((foundUser) => {
      // grab a reference to the data yet to be processed
      const locations = foundUser.backgroundLocationDataToBeProcessed;

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
            currentStartTime = Math.floor(observation.timestamp);
            currentEndTime = Math.floor(observation.timestamp);
            currentLatitude = observation.coords.latitude;
            currentLongitude = observation.coords.longitude;
            resolve();
          }

          // if the observation is within 0.1 miles of the current location
          else if (computeDistance(currentLatitude, currentLongitude, observation.coords.latitude, observation.coords.longitude, 'M') < 0.1) {
            currentEndTime = Math.floor(observation.timestamp);
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

            currentStartTime = Math.floor(observation.timestamp);
            currentEndTime = Math.floor(observation.timestamp);
            currentLatitude = observation.coords.latitude;
            currentLongitude = observation.coords.longitude;
            resolve();
          }

          else {
            currentStartTime = Math.floor(observation.timestamp);
            currentEndTime = Math.floor(observation.timestamp);
            currentLatitude = observation.coords.latitude;
            currentLongitude = observation.coords.longitude;
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

          // final result is processed, so now add it to this user's frequent locations array
          Promise.all(outputPromises).then(() => {
            addToFrequentLocations(uid, output);

            // delete the waiting pool since we've now processed it
            foundUser.backgroundLocationDataToBeProcessed = [];
            foundUser.save();
          });
        });
      });
    })
    .catch((error) => {
      console.error(error.message);
    });
};

// encodes a new token for a user object
function tokenForUser(user) {
  const timestamp = new Date().getTime();
  return jwt.encode({ sub: user.id, iat: timestamp }, process.env.AUTH_SECRET);
}

export { createUser, setModelRun, storeBackgroundData };
