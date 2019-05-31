import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import mongoose from 'mongoose';
import * as admin from 'firebase-admin';
import router from './router';

// initialize firebase admin
const serviceAccount = {
  type: 'service_account',
  project_id: 'boost-240320',
  private_key_id: '91f231bc1c8f8cfaa6c3711844438f46b4297d09',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEbmVwQvi3Fwlr\nDbG5Bj7a3779QlSd2z2RlQkJGOLYjtsD7uLWLjzdvVrmLyGCqeYFzL91zez+O6Vy\ngc3nHLIrc5BCyLs1oT1FCHcRJE0f03uLpMQhoIqH458FHxaQKYPAPrd6JkBhMHxT\nADxUoa1ju5KU3B/wRPH/69PCboJtSvAAgdKgkOamMUNXdRn3mM1x8axixbdKtBFh\nORj9NQT8NRgOJ0WK/XHaOXJbbZSb0oCFmRYPqrAK9F6aTxjtCBO3IPl/Trl/eYoQ\ntXULtj4Q2nt5bmXOafTKmeXT9m++lOYKF8r1qPsHJeebdHUjbCKzDqTEhAtZym5z\npG5tKz7FAgMBAAECggEAByaETMozUZQ7bzPdagB/Mz/SgleddZhF19HWtV0RjOk5\nBx31Ze84Sf4a8VF6j84YJdKROabttJzT5foxq527d/d0oz8OtDdoCpDx/KQXUUxF\nLWJ/EpZMf1aFiGMxqBJ1eFRldhiEXsVWu+gV9M1kiW005cmpjqPZMgQR/lGVhTLq\ne/d/qBbz3Mw6gSiibUsHyZCoTVq/bAPb749Tvx3qdujnzV7mZM1WIpixvMBgpCIp\nuAcEXR2p1lPrDNka0uXWeXGv5ny3XfaAqEewMsI5Ek7QRc0oXG8VuH/XEzdmq254\nXke33QKNr2tXl9TRpgZ9ddY+48nBW/SG0jBtC24XwQKBgQDiZuuR+On7fpL/elIQ\nQ8rEUu28KSvIltbVU/NMlyCy+MlnPIoupn1ELscKfEtvmjeQN56GHE6fVaPXB7ys\n3VdoNJFrdfFuNJU4Nl+loogR0LohjS2aCXrIa2+5XIP/NofC82gvSXcSshtzTUMx\nO4eRfYSer8klBU1JlmInWG4DtQKBgQDeHG6yTU4lBTLRXGOArazMJHC6CI5wUdy9\nNITcxOdnR2n4CpcR2Gdlp9o+Xge0a+6nh5hw9dMlWReUi8uCWF+mCveSBiaMEbYA\n7ji23GtSErY7vT3z6QyPGn/QpBt/Nvu9LFpRqNwFzxUTkSTWbt7vY9skTWQJTr4E\nfOfvdkRY0QKBgQDRzKQByhMxrfKUcoq3bcrpsRuC4Pgk0rrURw5P7EAt+WPRmgVH\nA5tTYrGp4tKY4eUZbKEnD/Y/qsHAEvhhjF9iPkx/s3T+NhYNWD28JOhI8g555vTa\nKGyyavTGZZggGS0nmB30q/R+y7OqXm+koNCZHyKVVrpj5wze40+jvEt+fQKBgFCV\n/EvQ5INmCXQQk0GCweknZ4b3x8ZUzUQQpAv9nP/J11bZcMpWu90UM4jhUOZTKrm5\n5sNFTaCFXJrWxbW7Hqj93akrdhzn6CMaS5V9D6stgtTV6n5uldHuCWXHxPo5Fski\nKHrsSzgIVFtPFBCBFX3BuybGtX7zBNpX/0bQoCehAoGAPl7poPDj+ZH8TFIA9Dcj\nzqXpxVgbniBJq/cr5w96QHu/2JaMaG8qWP024mpkEmHYAHzpS0D1yltj1pe9EX/i\nKArt/AY9J7I24gpO4XvBRzee/0vlwR80QsnZ3a7/hsIGicpIwKgW3T1KW2kKZKA+\ny9F02JxwkLLZXWfB0afDp8E=\n-----END PRIVATE KEY-----\n',
  client_email: 'firebase-adminsdk-1336i@boost-240320.iam.gserviceaccount.com',
  client_id: '100317169623947523870',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1336i%40boost-240320.iam.gserviceaccount.com',
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://boost-240320.firebaseio.com',
});

// initialize server
const app = express();

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true,
  parameterLimit: 50000,
}));

// DB Setup
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost/boost';
mongoose.connect(mongoURI);
// set mongoose promises to es6 default
mongoose.Promise = global.Promise;

app.use('/api', router);

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

console.log(`listening on: ${port}`);
