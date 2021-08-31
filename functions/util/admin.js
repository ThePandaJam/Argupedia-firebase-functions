//based on https://github.com/hidjou/classsed-react-firebase-functions/blob/master/functions/util/admin.js
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore()
module.exports = {admin, db};