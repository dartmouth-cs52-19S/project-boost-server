/* eslint-disable prefer-destructuring */
import jwt from 'jwt-simple';
import dotenv from 'dotenv';
import User from '../models/user_model';
import { LocationModel } from '../models/location_model';

dotenv.config({ silent: true });

// eslint-disable-next-line consistent-return
export const createUser = (req, res, next) => {
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

export const updateUserSettings = (req, res, next) => {
  const {
    userID, homeLocation, homeLocationLatLong, presetProductiveLocations,
  } = req.body;

  User.findOne({ _id: userID }).populate('frequentLocations')
    .exec((error, foundUser) => {
      if (error) {
        res.status(500).send(`Error upon saving user settings for user with id ${userID}. Could not find user.`);
      }

      else {
        foundUser.homeLocation = homeLocation; // set the home Location appropriately e.g. "Dartmouth Street, Boston, MA,USA"
        foundUser.latlongHomeLocation = homeLocationLatLong; // set the latLong for the user appropriately e.g. "42.3485196, -71.0765708"

        const newPresetProductiveLocations = {}; // create a new Object

        presetProductiveLocations.forEach((location) => { // loop through all the objects sent from the front-end
          const address = location.address;
          newPresetProductiveLocations[address] = location.productivity;
        // newPresetProductiveLocations.push({ [address]: location.productivity });
        // newPresetProductiveLocations.push({ address: location.address, productivity: location.productivity }); // 2d
        });

        if (Object.keys(newPresetProductiveLocations).length !== 0) {
          foundUser.presetProductiveLocations = newPresetProductiveLocations;
        }

        // end result should be foundUser.presetProductiveLocations = [ {"9 Maynard Street, Hanover, NH": 5}, {"Dartmouth Street, Boston, MA,USA: 3} ]

        foundUser.save()
          .then((response) => {
            console.log(`Success saving user settings for user with id ${userID}`);
          })
          .catch((err) => {
            if (err) {
              res.status(500).send(`Error upon saving user settings for user with id ${userID}`);
            }
          });

        // now, go into all the locations of this user and set strings and productivities respectively

        const allPresetProductiveLocationAddresses = Object.keys(presetProductiveLocations);

        foundUser.frequentLocations.forEach((locationObj) => {
          if (allPresetProductiveLocationAddresses.includes(locationObj.location)) {
            locationObj.productivity = presetProductiveLocations[locationObj.location];
          }

        // then must save the Location Object
        });
      } });
};


// old updateUserSettings before doing .populate and removing entire Location Object from User Model:

/* export const updateUserSettings = (req, res, next) => {
  const {
    userID, homeLocation, homeLocationLatLong, presetProductiveLocations,
  } = req.body;

  User.findOne({ _id: userID })
    .then((foundUser) => {
      foundUser.homeLocation = homeLocation; // set the home Location appropriately e.g. "Dartmouth Street, Boston, MA,USA"
      foundUser.latlongHomeLocation = homeLocationLatLong; // set the latLong for the user appropriately e.g. "42.3485196, -71.0765708"

      const newPresetProductiveLocations = []; // create a temp array

      presetProductiveLocations.forEach((location) => { // loop through all the objects sent from the front-end
        const address = location.address;
        newPresetProductiveLocations.push({ [address]: location.productivity });
        // newPresetProductiveLocations.push({ address: location.address, productivity: location.productivity }); // 2d
      });

      if (newPresetProductiveLocations !== 0) {
        foundUser.presetProductiveLocations = newPresetProductiveLocations;
      }

      // end result should be foundUser.presetProductiveLocations = [ {"9 Maynard Street, Hanover, NH": 5}, {"Dartmouth Street, Boston, MA,USA: 3} ]

      foundUser.save()
        .then((response) => {
          console.log(`Success saving user settings for user with id ${userID}`);
        })
        .catch((error) => {
          if (error) {
            res.status(500).send(`Error upon saving user settings for user with id ${userID}`);
          }
        });

      // now, go into all the locations of this user and set strings and productivities respectively
    })
    .catch((error) => {
      res.status(500).send(`Error finding user with id ${userID}`);
    });
}; */

export const setModelRun = (req, res, modelOutput) => {
  const { uid } = req.body; // userID obtained from firebase sign in w. Google

  if (!uid) {
    return res.status(422).send('You must provide the firebase userID');
  }

  User.findOne({ _id: uid })
    .then((foundUser) => {
      if (foundUser === null) {
        res.status(500).send(`No user exists with id: ${uid}`);
      } else {
        foundUser.frequentLocations = [];

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

              // location is null, TODO: make google API call to figure out where this is
              // productivity is null, can search on user, frequent locations .find({ productivity: null })

              // save location object, then append to frequentLocations array and resolve promise
              locationObj.save().then(() => {
                foundUser.frequentLocations.push(locationObj);
                resolve();
              }).catch((err) => {
                reject(err);
              });
            }));
          });
        });

        // when all location objects for this user are created, save this user and send to res
        Promise.all(locationPromises).then(() => {
          foundUser.save().then(() => {
            res.send({ message: 'success!' });
          }).catch((err) => {
            res.status(500).send(err);
          });
        });
      }
    }) // end of .then
    .catch((err) => {
      res.sendStatus(500);
    });
};


// encodes a new token for a user object
function tokenForUser(user) {
  const timestamp = new Date().getTime();
  return jwt.encode({ sub: user.id, iat: timestamp }, process.env.AUTH_SECRET);
}
