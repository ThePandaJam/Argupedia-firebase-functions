// based on https://github.com/hidjou/classsed-react-firebase-functions/blob/master/functions/util/fbAuth.js
//helper function for detecting empty strings
const isEmpty = (string) => {
    if (string.trim() === '')
        return true;
    else
        return false;
}

const isEmail = (email) => {
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(emailRegEx)){
        return true;
    } else return false;
}

exports.validateSignupData = (data) => {
    let errors = {};

    if(isEmpty(data.email)) {
        errors.email = 'Must not be empty'
    } else if (!isEmail(data.email)){
        errors.email = 'Must be a valid email address'
    }

    if(isEmpty(data.password)) {
        errors.password = 'Must not be empty'
    }

    if(data.password !== data.passwordConfirm) {
        errors.passwordConfirm = 'Passwords must match'
    }

    if(isEmpty(data.handle)) {
        errors.handle = 'Must not be empty'
    }
    
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateLoginData = (data) => {
    let errors = {};

    if (isEmpty(data.email)) errors.email = "Must not be empty";
    if (isEmpty(data.password)) errors.password = "Must not be empty";

    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validatePostData = (data) => {
    let errors = {};

    if(isEmpty(data.title)) {
        errors.email = 'Must not be empty'
    }

    if(isEmpty(data.scheme)) {
        errors.password = 'Select a scheme'
    }

    if(isEmpty(data.majorPremise)) {
        errors.handle = 'Must not be empty'
    }

    if(isEmpty(data.minorPremise)) {
        errors.handle = 'Must not be empty'
    }

    if(isEmpty(data.conclusion)) {
        errors.handle = 'Must not be empty'
    }
    
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.reduceUserDetails = (data) => {
    let userDetails = {};
    //check that bio is not empty
    if(!isEmpty(data.bio.trim())) userDetails.bio = data.bio;
    //check that website is not empty
    if(!isEmpty(data.website.trim())) {
        // if user sumbits a website without included https://, append http://, otherwise add website as is 
        if (data.website.trim().substring(0, 4) !== 'http'){
            userDetails.website = `http://${data.website.trim()}`;
        }else userDetails.website = data.website;
    }
    //check that location is not empty
    if(!isEmpty(data.location.trim())) userDetails.location = data.location;
    
    return userDetails
}