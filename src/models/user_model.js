import mongoose, { Schema } from 'mongoose';

const bcrypt = require('bcryptjs');

const UserSchema = new Schema({
  username: { type: String, unique: true, lowercase: true },
  email: { type: String, unique: true, lowercase: true },
  password: { type: String },
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
