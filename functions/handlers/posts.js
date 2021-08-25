const { db } = require('../util/admin')

exports.getAllPosts = (req, res) => {
    db.collection('posts')
        .orderBy('createdAt', 'desc')
        .get()
        .then(data => {
            let posts = [];
            data.forEach((doc) => {
                posts.push({
                    postId: doc.id,
                    ...doc.data()
                    //userImage: doc.data().userImage
                });
            });
            return res.json(posts);
        })
        .catch(err => console.error(err));
}

exports.postOnePost = (req, res) => {
    if(req.body.body.trim() === ''){
        return res.status(400).json({ body: 'Post title must not be empty' });
    }
    
    const newPost = {
        body: req.body.body,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString(),
        userScore: 0,
        argumentCount: 0

    }
    db.collection('posts')
        .add(newPost)
        .then(doc => {
            const resPost = newPost;
            resPost.postId = doc.id;
            res.json(resPost)
        })
        .catch(err => {
            res.status(500).json({ error: `something went wrong`});
            console.error(err);
        })
}

//fetch one post and its arguments
exports.getPost = (req, res) => {
    let postData = {}
    db.doc(`/posts/${req.params.postId}`)
        .get()
        .then(doc => {
            if(!doc.exists){
                return res.status(404).json({ error: 'Post not found' })
            }
            postData = doc.data();
            postData.postId = doc.id;
            return db
                .collection('arguments')
                .orderBy('createdAt', 'desc')  
                .where('postId', '==', req.params.postId)
                .get();
        })
        .then(data => {
            postData.comments = [];
            data.forEach(doc => {
                postData.comments.push(doc.data())
            });
            return res.json( postData );
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })
}
// comment an argument on a post
exports.addArgumentToPost = (req, res) => {
    //check that the argument body is not empty
    //TODO: adapt this to include more fields
    if(req.body.body.trim() === '') 
        return res.status(400).json({ comment: 'argument must not be empty'});
    const newArgument = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        postId: req.params.postId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl
    };
    //confirm that the post exists
    db.doc(`/posts/${req.params.postId}`).get()
        .then(doc => {
            if(!doc.exists){
                return res.status(404).json({ error: 'Post not found'});
            }
            return doc.ref.update({ argumentCount: doc.data().argumentCount + 1})
        })
        .then(() => {
            return db.collection('arguments').add(newArgument);
        })
        .then(() => {
            res.json(newArgument);
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'Something went wrong'})
        })
}
//upvote a post
exports.upvotePost = (req, res) => {
    //check if a liked post exists or not
    //check if the post has already been liked
    const upvoteDocument = db
        .collection('upvotes')
        .where('userHandle', '==', req.user.handle)
        .where('postId', '==', req.params.postId)
        .limit(1);

    const postDocument = db.doc(`/posts/${req.params.postId}`);

    let postData = {}

    postDocument
        .get()
        .then((doc) => {
            if(doc.exists){
                postData = doc.data();
                postData.postId = doc.id;
                return upvoteDocument.get();
            } else {
                return res.status(404).json({ error: 'Post not found' });
            }
        })
        .then(data => {
            if (data.empty){
                return db
                    .collection('upvotes')
                    .add({
                        postId: req.params.postId,
                        userHandle: req.user.handle
                    })
                    .then(() => {
                        postData.userScore++
                        return postDocument.update({ userScore: postData.userScore });
                    })
                    .then(()=> {
                        return res.json(postData);
                    })
            } else {
                return res.status(400).json({ error: 'Post already upvoted'});
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })

}
//remove an upvote
exports.unUpvotePost = (req, res) => {
    const upvoteDocument = db
        .collection('upvotes')
        .where('userHandle', '==', req.user.handle)
        .where('postId', '==', req.params.postId)
        .limit(1);

    const postDocument = db.doc(`/posts/${req.params.postId}`);

    let postData = {}

    postDocument
        .get()
        .then((doc) => {
            if(doc.exists){
                postData = doc.data();
                postData.postId = doc.id;
                return upvoteDocument.get();
            } else {
                return res.status(404).json({ error: 'Post not found' });
            }
        })
        .then(data => {
            if (data.empty){
                return res.status(400).json({ message: 'Post not upvoted'});
            } else {
                return db
                    .doc(`/upvotes/${data.docs[0].id}`)
                    .delete()
                    .then(() => {
                        postData.userScore--;
                        return postDocument.update({ userScore: postData.userScore });
                    })
                    .then(()=> {
                        return res.json(postData);
                    })
            }
        })
        .catch(err => {
            console.error(err)
            res.status(500).json({ error: err.code });
        })
}

//downvote a post
exports.downvotePost = (req, res) => {
    //check if a downvoted post exists or not
    //check if the post has already been downvoted
    const downvoteDocument = db
        .collection('downvotes')
        .where('userHandle', '==', req.user.handle)
        .where('postId', '==', req.params.postId)
        .limit(1);

    const postDocument = db.doc(`/posts/${req.params.postId}`);

    let postData = {}

    postDocument
        .get()
        .then((doc) => {
            if(doc.exists){
                postData = doc.data();
                postData.postId = doc.id;
                return downvoteDocument.get();
            } else {
                return res.status(404).json({ error: 'Post not found' });
            }
        })
        .then(data => {
            if (data.empty){
                return db
                    .collection('downvotes')
                    .add({
                        postId: req.params.postId,
                        userHandle: req.user.handle
                    })
                    .then(() => {
                        postData.userScore--
                        return postDocument.update({ userScore: postData.userScore });
                    })
                    .then(()=> {
                        return res.json(postData);
                    })
            } else {
                return res.status(400).json({ error: 'Post already downvoted'});
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })

}

//remove a downvote
exports.unDownvotePost = (req, res) => {
    const downvoteDocument = db
        .collection('downvotes')
        .where('userHandle', '==', req.user.handle)
        .where('postId', '==', req.params.postId)
        .limit(1);

    const postDocument = db.doc(`/posts/${req.params.postId}`);

    let postData = {}

    postDocument
        .get()
        .then((doc) => {
            if(doc.exists){
                postData = doc.data();
                postData.postId = doc.id;
                return downvoteDocument.get();
            } else {
                return res.status(404).json({ error: 'Post not found' });
            }
        })
        .then(data => {
            if (data.empty){
                return res.status(400).json({ message: 'Post not downvoted'});
            } else {
                return db
                    .doc(`/downvotes/${data.docs[0].id}`)
                    .delete()
                    .then(() => {
                        postData.userScore++;
                        return postDocument.update({ userScore: postData.userScore });
                    })
                    .then(()=> {
                        return res.json(postData);
                    })
            }
        })
        .catch(err => {
            console.error(err)
            res.status(500).json({ error: err.code });
        })
}

//delete post
exports.deletePost = (req, res) => {
    const document = db.doc(`/posts/${req.params.postId}`);
    document
        .get()
        .then((doc) => {
            if (!doc.exists){
                return res.status(404).json({ error: 'Post not found' });
            }
            if(doc.data().userHandle !== req.user.handle){
                return res.status(403).json({ error: 'Unauthorised'})
            } else {
                return document.delete();
            }
        })
        .then(()=> {
            res.json({ message: 'Post deleted successfully'});
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
        
};
