import mongoose, { Schema } from 'mongoose';

// create a Location Schema

const LocationSchema = new Schema({
  location: String,
  latLongLocation: String,
  startTime: Number,
  endTime: Number,
  productivity: Number,
}, {
  toJSON: {
    virtuals: true,
  },
});

// create LocationModel class from schema
const LocationModel = mongoose.model('Location', LocationSchema);

export { LocationSchema, LocationModel };
