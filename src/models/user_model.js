import mongoose, { Schema } from 'mongoose';
import { LocationSchema } from './location_model';

const UserSchema = new Schema({
  _id: { type: String, unique: true }, // taken from the uID in firebase
  presetProductiveLocations: Object, // on initial start, user selects which places are productive or not
  mostProductiveWeekDay: String,
  leastProductiveWeekDay: String,
  homeLocation: String, // for every user, have a "home location" that they enter
  latlongHomeLocation: String, // convert "home location" into a lat long e.g. "43.7041448 , -72.2890539"
  settings: Object, // e.g. { darkMode: activated, dataProcessingTime: "18:00" }
  backgroundLocationDataToBeProcessed: [Object],
  frequentLocations: [LocationSchema],
  initialUploadData: {
    type: Schema.Types.Mixed, // mixed type means that you can store anything in this field. Mongoose won't yell at you or type cast. should be fine since we're storing the output
  },
}, { _id: false });

UserSchema.set('toJSON', {
  virtuals: true,
});

const UserModel = mongoose.model('User', UserSchema);

export default UserModel;
