let db = {
    users: [
        {
            userId: 'dh23ggj5h32g543j5gf43',
            email: 'user@email.com',
            handle:'user',
            createdAt: '2021-08-18T13:47:31.998Z',
            imageUrl: 'image/ksajhfkjhf/dskfhjs',
            bio: 'Hello my name is user',
            website: 'https://user.com',
            location: 'London, UK'
        }
    ],
    posts: [
        {
            userHandle: 'user',
            body: 'this is the post body',
            createdAt: '2021-08-18T13:48:31.998Z',
            userScore: 5,
            argumentCount: 2
        }
    ],
    comments: [
        {
            userHandle: 'user',
            postId: 'klwehfsdjkhfkjsdh',
            body:'This is an Ad Hominem fallacy',
            createdAt: '2021-08-18T13:49:31.998Z'
        }
    ],
    notifications: [
        {
            recipient: 'user',
            sender: 'john',
            read: 'true | false',
            postId: 'kdjsfgdksuufhgkdsufky',
            type: 'upvote | downvote | argument',
            createdAt: '2021-08-18T14:49:31.998Z'
        }
    ]
}

const userDetails = {
    //Redux data
    //user information held in redux state in the front end of the application
    credentials: {
        userId: 'dh23ggj5h32g543j5gf43',
        email: 'user@email.com',
        handle:'user',
        createdAt: '2021-08-18T13:47:31.998Z',
        imageUrl: 'image/ksajhfkjhf/dskfhjs',
        bio: 'Hello my name is user',
        website: 'https://user.com',
        location: 'London, UK'
    },
    upvotes: [
        {
            userHandle: 'user',
            postId: 'hh705oWfWucVzGbHH2pa'
        }
    ],
    downvotes: [
        {
            userHandle: 'user',
            postId: '3IOnFoQrxRcofs5OhBXO'
        }
    ]
}