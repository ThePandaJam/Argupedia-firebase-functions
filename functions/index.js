const functions = require("firebase-functions");
const app = require('express')();
const FBAuth = require('./util/fbAuth');

const cors = require('cors');
app.use(cors());

const { db } = require('./util/admin')

const { 
    getAllPosts, 
    postOnePost, 
    getPost, 
    addArgumentToPost,
    upvotePost,
    unUpvotePost,
    downvotePost,
    unDownvotePost,
    deletePost
} = require('./handlers/posts')

const { 
    signup, 
    login, 
    uploadImage, 
    addUserDetails, 
    getAuthenticatedUser,
    getUserDetails,
    markNotificationsRead
} = require('./handlers/users')

//post (Argupedia debates) routes
app.get('/posts', getAllPosts)
app.post('/post', FBAuth, postOnePost);
app.get('/post/:postId', getPost);
//TODO: check if the user has already downvoted the post, if yes, remove the downvote and add the upvote instead
app.get('/post/:postId/upvote', FBAuth, upvotePost);
app.get('/post/:postId/unupvote', FBAuth, unUpvotePost);
//TODO: check if the user has already upvoted the post, if yes, remove the upvote and add the downvote instead
app.get('/post/:postId/downvote', FBAuth, downvotePost);
app.get('/post/:postId/undownvote', FBAuth, unDownvotePost);
app.post('/post/:postId/argument', FBAuth, addArgumentToPost);
app.delete('/post/:postId', FBAuth, deletePost);


// user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

exports.api = functions.region('europe-west1').https.onRequest(app);

//database trigger
//remove this eventually bc individual upvotes don't really add much to the user experience
exports.createNotificationOnUpvote = functions
    .region('europe-west1')
    .firestore.document('upvotes/{id}')
    .onCreate((snapshot) => {
        return db
            .doc(`/posts/${snapshot.data().postId}`)
            .get()
            .then(doc => {
                if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'upvote',
                        read: false,
                        postId: doc.id
                    });
                }
            })
            .catch(err => {
                console.error(err);
            })
    });

exports.deleteNotificationOnUnUpvote = functions
    .region('europe-west1')
    .firestore.document('upvotes/{id}')
    .onDelete((snapshot) => {
        return db
            .doc(`/notifications/${snapshot.id}`)
            .delete()
            .catch(err => {
                console.error(err);
                return;
            })
    })

exports.createNotificationOnArgument = functions
    .region('europe-west1')
    .firestore.document('arguments/{id}')
    .onCreate((snapshot) => {
        return db
            .doc(`/posts/${snapshot.data().postId}`)
            .get()
            .then(doc => {
                if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'argument',
                        read: false,
                        postId: snapshot.data().postId
                    });
                }
            })
            .catch(err => {
                console.error(err);
                return;
            })
    });

//database trigger when user changes their image
exports.onUserImageChange = functions
    .region('europe-west1')
    .firestore.document('/users/{userId}')
    .onUpdate((change) => {
        console.log(change.before.data());
        console.log(change.after.data());
        if (change.before.data().imageUrl !== change.after.data().imageUrl){
            console.log('image has changed');
            const batch = db.batch();
            return db
                .collection('posts')
                .where('userHandle', '==', change.before.data().handle)
                .get()
                .then((data) =>{
                    data.forEach(doc => {
                        const post = db.doc(`/posts/${doc.id}`);
                        batch.update(post, { userImage : change.after.data().imageUrl })
                    })
                    return batch.commit();
                })
        }
    });

//remove all comments, upvotes/downvotes and notifications when a post is deleted
//TODO add downvotes to the list of deleted items 
exports.onPostDelete = functions
    .region('europe-west1')
    .firestore.document('/posts/{postId}')
    .onDelete((snapshot, context) => {
        const postId = context.params.postId;
        const batch = db.batch();
        return db.collection('arguments').where('postId', '==', postId).get()
            .then(data => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/arguments/${doc.id}`));
                })
                return db.collection('upvotes').where('postId', '==', postId).get();
            })
            .then(data => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/upvotes/${doc.id}`));
                })
                return db.collection('downvotes').where('postId', '==', postId).get();
            })
            .then(data => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/downvotes/${doc.id}`));
                })
                return db.collection('notifications').where('postId', '==', postId).get();
            })
            .then(data => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/notifications/${doc.id}`));
                })
                return batch.commit();
            })
            .catch(err => {
                console.error(err);
            })
    })