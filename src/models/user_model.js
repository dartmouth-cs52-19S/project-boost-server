import mongoose, { Schema } from 'mongoose';

const bcrypt = require('bcryptjs');

const UserSchema = new Schema({
  user_id: { type: String, unique: true }, // taken from the uID in firebase
  locationAlgorithmOutput: [{
    location: String,
  }], // stores the output of the algorithm
  presetProductiveLocations: [String], // on initial start, user selects which places are productive or not
  homeLocation: String, // for every user, have a "home location" that they enter
  userInputOnProductivity: [{ // e.g. {date: May 12 2019, time: 4:00PM, location: Topliff, productivity: 1}
    date: String,
    time: Date,
    location: String,
    productivity: Number,
  }],
});

UserSchema.set('toJSON', {
  virtuals: true,
});

UserSchema.pre('save', function beforeYourModelSave(next) {
  const user = this;

  // only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next();

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(user.password, salt);

  user.password = hash;

  return next();
});

UserSchema.methods.comparePassword = function comparePassword(candidatePassword, callback) {
  const user = this;

  // return callback(null, comparisonResult) for success
  // or callback(error) in the error case
  bcrypt.compare(candidatePassword, user.password, (err, res) => {
    if (err) {
      return callback(err);
    } else {
      return callback(null, res);
    }
  });
};

const UserModel = mongoose.model('User', UserSchema);

export default UserModel;
