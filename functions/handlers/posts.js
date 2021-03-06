//based on https://github.com/hidjou/classsed-react-firebase-functions/blob/master/functions/handlers/screams.js 
const { db } = require('../util/admin')
const { validatePostData } = require('../util/validators')

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
                });
            });
            return res.json(posts);
        })
        .catch(err => console.error(err));
}

exports.getAllSchemes = (req, res) => {
    db.collection('schemes')
        .orderBy('listOrder')
        .get()
        .then(data => {
            let schemes = [];
            data.forEach((doc) => {
                schemes.push({
                    schemeId: doc.id,
                    ...doc.data()
                });
            });
            return res.json(schemes);
        })
        .catch(err => console.error(err));
}
//fetch the critical questions for a scheme
exports.getSchemeData = (req, res) => {
    let schemeData = {}
    db.doc(`/schemes/${req.params.schemeId}`)
        .get()
        .then(doc => {
            if(!doc.exists){
                return res.status(404).json({ error: 'Scheme info not found' })
            }
            schemeData.schemeId = doc.id;
            schemeData.premisesAndConclusion = doc.data();
            return db
                .collection('criticalQuestions')
                .where('schemeId', '==', req.params.schemeId)
                .orderBy('questionNo')  
                .get();
            
        })
        .then(data => {
            schemeData.criticalQuestions = [];
            data.forEach(doc => {
                schemeData.criticalQuestions.push({
                    questionNo: doc.data().questionNo,
                    questionBody: doc.data().questionBody
                    //...doc.data()
                })
            });
            return res.json( schemeData );
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })
}

exports.postOnePost = (req, res) => {
    //validate post fields
    const newPost = {
        title: req.body.title,
        scheme: req.body.scheme,
        schemeId: req.body.schemeId,
        majorPremise: req.body.majorPremise,
        minorPremise: req.body.minorPremise,
        conclusion: req.body.conclusion,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString(),
        userScore: 0,
        argumentCount: 0
    }
    
    const { valid, errors } = validatePostData(newPost);
    if (!valid) return res.status(400).json(errors)
    //TODO: and add scheme
    
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

//fetch one post, its arguments and graph data
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
            //get nodes for a post's argument graph 
            postData.graphData = {}
            postData.graphData.nodes = [
                {"id" : "Original-post"}
            ]
            data.forEach(doc => {
                postData.comments.push({
                    argumentId: doc.id,
                    ...doc.data()
                })
                postData.graphData.nodes.push({
                    id: doc.id
                })
            });

            return db
                .collection('attacks')
                .where('postId', '==', req.params.postId)
                .get();
        })
        .then(data => {
            //get links for a post's argument graph 
            postData.graphData.links = []
            data.forEach(doc => {
                postData.graphData.links.push({
                    source: doc.data().source,
                    target: doc.data().target
                })
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
        respondingTo: req.body.respondingTo,
        schemeId: req.body.schemeId,
        questionNo: req.body.questionNo,
        body: req.body.body,
        createdAt: new Date().toISOString(),
        postId: req.params.postId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        argumentScore: 0
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
        .then((doc) => {
            const resArgument = newArgument;
            resArgument.argumentId = doc.id;
            res.json(resArgument);
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
//remove an upvote from post
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

//upvote a comment (argument)
exports.upvoteArgument = (req, res) => {
    const upvoteArgumentDocument = db
        .collection('argumentUpvotes')
        .where('userHandle', '==', req.user.handle)
        .where('argumentId', '==', req.params.argumentId)
        .limit(1);

    const argumentDocument = db.doc(`/arguments/${req.params.argumentId}`);

    let argumentData = {}

    argumentDocument
        .get()
        .then((doc) => {
            if(doc.exists){
                argumentData = doc.data();
                argumentData.argumentId = doc.id;
                return upvoteArgumentDocument.get();
            } else {
                return res.status(404).json({ error: 'Argument not found' });
            }
        })
        .then(data => {
            if (data.empty){
                return db
                    .collection('argumentUpvotes')
                    .add({
                        argumentId: req.params.argumentId,
                        userHandle: req.user.handle
                    })
                    .then(() => {
                        argumentData.argumentScore++
                        return argumentDocument.update({ argumentScore: argumentData.argumentScore });
                    })
                    .then(()=> {
                        return res.json(argumentData);
                    })
            } else {
                return res.status(400).json({ error: 'Argument already upvoted'});
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })

}
//remove upvote form comment (argument)
exports.unUpvoteArgument = (req, res) => {
    const upvoteArgumentDocument  = db
        .collection('argumentUpvotes')
        .where('userHandle', '==', req.user.handle)
        .where('argumentId', '==', req.params.argumentId)
        .limit(1);

    const argumentDocument = db.doc(`/arguments/${req.params.argumentId}`);

    let argumentData  = {}

    argumentDocument
        .get()
        .then((doc) => {
            if(doc.exists){
                argumentData  = doc.data();
                argumentData.argumentId = doc.id;
                return upvoteArgumentDocument.get();
            } else {
                return res.status(404).json({ error: 'Argument not found' });
            }
        })
        .then(data => {
            if (data.empty){
                return res.status(400).json({ message: 'Argument not upvoted'});
            } else {
                return db
                    .doc(`/argumentUpvotes/${data.docs[0].id}`)
                    .delete()
                    .then(() => {
                        argumentData.argumentScore--;
                        return argumentDocument.update({ argumentScore: argumentData.argumentScore });
                    })
                    .then(()=> {
                        return res.json(argumentData);
                    })
            }
        })
        .catch(err => {
            console.error(err)
            res.status(500).json({ error: err.code });
        })
}

//downvote a comment (argument)
exports.downvoteArgument = (req, res) => {
    const downvoteArgumentDocument = db
        .collection('argumentDownvotes')
        .where('userHandle', '==', req.user.handle)
        .where('argumentId', '==', req.params.argumentId)
        .limit(1);

    const argumentDocument = db.doc(`/arguments/${req.params.argumentId}`);

    let argumentData = {}

    argumentDocument
        .get()
        .then((doc) => {
            if(doc.exists){
                argumentData = doc.data();
                argumentData.argumentId = doc.id;
                return downvoteArgumentDocument.get();
            } else {
                return res.status(404).json({ error: 'Argument not found' });
            }
        })
        .then(data => {
            if (data.empty){
                return db
                    .collection('argumentDownvotes')
                    .add({
                        argumentId: req.params.argumentId,
                        userHandle: req.user.handle
                    })
                    .then(() => {
                        argumentData.argumentScore--
                        return argumentDocument.update({ argumentScore: argumentData.argumentScore });
                    })
                    .then(()=> {
                        return res.json(argumentData);
                    })
            } else {
                return res.status(400).json({ error: 'Argument already downvoted'});
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })

}

//remove downvote form comment (argument)
exports.unDownvoteArgument = (req, res) => {
    const downvoteArgumentDocument  = db
        .collection('argumentDownvotes')
        .where('userHandle', '==', req.user.handle)
        .where('argumentId', '==', req.params.argumentId)
        .limit(1);

    const argumentDocument = db.doc(`/arguments/${req.params.argumentId}`);

    let argumentData  = {}

    argumentDocument
        .get()
        .then((doc) => {
            if(doc.exists){
                argumentData  = doc.data();
                argumentData.argumentId = doc.id;
                return downvoteArgumentDocument.get();
            } else {
                return res.status(404).json({ error: 'Argument not found' });
            }
        })
        .then(data => {
            if (data.empty){
                return res.status(400).json({ message: 'Argument not downvoted'});
            } else {
                return db
                    .doc(`/argumentDownvotes/${data.docs[0].id}`)
                    .delete()
                    .then(() => {
                        argumentData.argumentScore++;
                        return argumentDocument.update({ argumentScore: argumentData.argumentScore });
                    })
                    .then(()=> {
                        return res.json(argumentData);
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
