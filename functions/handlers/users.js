const {db, admin} = require('../util/admin');

const config = require('../util/config')

const firebase = require('firebase');
firebase.initializeApp(config)

const { validateSignupData, validateLoginData, reduceUserDetails } = require('../util/validators')

//sign up a new user
exports.signup = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        handle: req.body.handle,
    };
    const { valid, errors } = validateSignupData(newUser);

    if (!valid) return res.status(400).json(errors);

    const noImage = 'blank-profile-picture.png'
    
    let token, userId;
    db.doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if (doc.exists){
                return res.status(400).json({ handle: `this handle is already taken`});
            } else {
                return firebase
                    .auth()
                    .createUserWithEmailAndPassword(newUser.email, newUser.password)
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then(idToken => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImage}?alt=media`,
                userId
            };
            return db.doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then(() => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use'){
                return res.status(400).json({ email: 'Email is already in use'})
            } else {
                return res.status(500).json({ general: 'Something went wrong. Please try again' })
            }
        })
}

//log existing user in
exports.login = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    const { valid, errors } = validateLoginData(user);

    if (!valid) return res.status(400).json(errors)

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.json({ token });
        })
        .catch(err => {
            console.error(err);
            //two different possible errors associated with logging in
            //auth/wrong-password
            //auth/user-not-found
            
            return res
                .status(403)
                .json({ general: 'Wrong credentials. Please try again'})
            
        });

}

// add user details
exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body);

    db.doc(`/users/${req.user.handle}`).update(userDetails)
        .then(() => {
            return res.json({message: 'Details added successfully'})
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code })
        })
}

//get any user's details
exports.getUserDetails = (req,res) => {
    let userData = {};
    db.doc(`users/${req.params.handle}`).get()
        .then(doc => {
            if(doc.exists){
                userData.user = doc.data();
                return db.collection('posts').where('userHandle', '==', req.params.handle)
                    .orderBy('createdAt', 'desc')
                    .get()
            } else {
                return res.status(404).json({ error: 'user not found'})
            }
        })
        .then(data => {
            userData.posts = []
            data.forEach(doc => {
                userData.posts.push({
                    body: doc.data().body,
                    createdAt: doc.data().createdAt,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    userScore: doc.data().userScore,
                    argumentCount: doc.data().argumentCount,
                    postId: doc.id
                })
            });
            return res.json(userData);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        })
}

//get own user details
exports.getAuthenticatedUser = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.user.handle}`)
        .get()
        .then((doc) => {
            if (doc.exists){
                userData.credentials = doc.data();
                return db
                    .collection("upvotes")
                    .where("userHandle", "==", req.user.handle)
                    .get()
            }
        })
        .then((data) => {
            userData.upvotes = [];
            data.forEach((doc) => {
                userData.upvotes.push(doc.data());
            });
            return db
                .collection("downvotes")
                .where("userHandle", "==", req.user.handle)
                .get()
        })
        .then((data) => {
            userData.downvotes = [];
            data.forEach((doc) => {
                userData.downvotes.push(doc.data());
            });
            return db
                .collection('notifications')
                .where('recipient', '==', req.user.handle)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
        })
        .then(data => {
            userData.notifications = [];
            data.forEach(doc => {
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    createdAt: doc.data().createdAt,
                    postId: doc.data().postId,
                    type: doc.data().type,
                    read: doc.data().read,
                    notificationId: doc.id,
                })
            })
            return res.json(userData);
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
}

//upload a profile image for user
exports.uploadImage = (req,res) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busboy = new BusBoy({ headers: req.headers });

    let imageFilename;
    let imageToBeUploaded = {};

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        console.log(fieldname);
        console.log(filename);
        console.log(mimetype);
        //prevent users from uploading non-image files
        if(mimetype !== 'image/jpeg' && mimetype !== 'image/png'){
            return res.status(400).json({ error: 'This filetype is not accepted'})
        }


        // image.png (get the part that's the extension)
        const imageExtension = filename.split('.')[filename.split('.').length - 1];
        //1390479238472.png
        imageFilename = `${Math.round(Math.random()*1000000000)}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imageFilename);
        imageToBeUploaded = {filepath, mimetype};
        //creates file
        file.pipe(fs.createWriteStream(filepath));
    });
    busboy.on('finish', () => {
        admin
            .storage()
            .bucket(`${config.storageBucket}`)
            .upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                contentType: imageToBeUploaded.mimetype
            }
        })
        .then(() => {
            //construct image url to add to user
            //alt media shows the pic in browser instead of downloading it to the user's device
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFilename}?alt=media`
            return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
        })
        .then(() => {
            return res.json({message: 'Image uploaded successfully'});
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code});
        });
    });
    busboy.end(req.rawBody);
};

exports.markNotificationsRead = (req, res) => {
    //batch write
    let batch = db.batch();
    req.body.forEach((notificationId) => {
        const notification = db.doc(`/notifications/${notificationId}`)
        batch.update(notification, { read: true });
    });
    batch
        .commit()
        .then(() => {
            return res.json({message: 'Notifications marked read'});
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({error: err.code});
        })
}