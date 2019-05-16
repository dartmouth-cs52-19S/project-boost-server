import mongoose, { Schema } from 'mongoose';

// create a Location Schema

const LocationSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  location: String,
  latLongLocation: String,
  startTime: String,
  endTime: String,
  productivity: Number,
}, {
  toJSON: {
    virtuals: true,
  },
});

// create LocationModel class from schema
const LocationModel = mongoose.model('Location', LocationSchema);

export default LocationModel;
