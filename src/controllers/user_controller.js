import jwt from 'jwt-simple';
import dotenv from 'dotenv';
import User from '../models/user_model';

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

export const signin = (req, res, next) => {
  User.findOne({ email: req.body.email })
    .then((result) => {
      res.send({
        token: tokenForUser(req.user),
        userData: {
          id: result.id,
          email: result.email,
          username: result.username,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({ error });
    });
};

export const signup = (req, res, next) => {
  const { email } = req.body;
  const { password } = req.body;
  const { username } = req.body;

  if (!email || !password || !username) {
    res.status(422).send('You must provide username, email, and password.');
  }

  // here you should do a mongo query to find if a user already exists with this email.
  // if user exists then return an error. If not, use the User model to create a new user.
  // Save the new User object
  // this is similar to how you created a Post
  // and then return a token same as you did in in signin
  User.countDocuments({ email, username }, (err, count) => {
    if (err) {
      res.status(500).send(err);
    } else if (count > 0) {
      res.status(422).send(`A user already exists with email: ${email} and/or username: ${username}.`);
    } else {
      const user = new User();

      user.email = email;
      user.password = password;
      user.username = username;

      user.save()
        .then((result) => {
          res.send({
            token: tokenForUser(result),
            userData: {
              id: result.id,
              email: result.email,
              username: result.username,
            },
          });
        })
        .catch((error) => {
          res.status(500).json({ error });
        });
    }
  });
};

// encodes a new token for a user object
function tokenForUser(user) {
  const timestamp = new Date().getTime();
  return jwt.encode({ sub: user.id, iat: timestamp }, process.env.AUTH_SECRET);
}
