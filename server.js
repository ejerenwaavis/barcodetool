const SERVER = !(process.execPath.includes("C:"));//process.env.PORT;
if (!SERVER){
  require("dotenv").config();
}


// const CLIENT_ID = process.env.CLIENTID;
// const CLIENT_SECRETE = process.env.CLIENTSECRETE;

// const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
// const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
// const HEREAPI = process.env.HEREAPI;

const MONGOPASSWORD = process.env.MONGOPASSWORD;
const MONGOUSER = process.env.MONGOUSER;
const MONGOURI2 = process.env.MONGOURI2;


// const SALTROUNDS = 10;
const SECRETE = process.env.SECRETE;
// const STRIPEAPI = process.env.STRIPEAPI;

const APP_DIRECTORY = !(SERVER) ? "" : ((process.env.APP_DIRECTORY) ? (process.env.APP_DIRECTORY) : "");
const PUBLIC_FOLDER = (SERVER) ? "./" : "../";
const PUBLIC_FILES = process.env.PUBLIC_FILES;
const TEMP_FILEPATH = (process.env.TEMP_FILEPATH ? process.env.TEMP_FILEPATH : 'tmp/');


const tempFilePath = TEMP_FILEPATH;
// var populateErrors = [];


const express = require("express");
const app = express();
const ejs = require("ejs");
const papa = require("papaparse");
const bodyParser = require("body-parser");
const fs = require("fs");
// const fsp = require('fs/promises');
const path = require("path");
// const Excel = require('exceljs');
// const formidable = require('formidable');
const mongoose = require("mongoose");
// const bcrypt = require('bcrypt');
// const nodemailer = require('nodemailer');
// const stripe = require("stripe")(STRIPEAPI);

// const session = require("express-session");
// const passport = require('passport');
// const passportLocalMongoose = require("passport-local-mongoose");
// const LocalStrategy = require('passport-local').Strategy;
// const FacebookStrategy = require('passport-facebook').Strategy;
// const GoogleStrategy = require('passport-google-oauth20').Strategy;


// Configure app to user EJS abd bodyParser
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(express.static(tempFilePath));
app.use(express.static("."));
app.use(express.json());


/******************** Authentication Setup & Config *************/
//Authentication & Session Management Config
// app.use(session({
//   secret: SECRETE,
//   resave: false,
//   saveUninitialized: false,

// }));
// app.use(passport.initialize());
// app.use(passport.session());

// Mongoose Configuration and Setup
const uri = "mongodb+srv://" + MONGOUSER + ":" + MONGOPASSWORD + MONGOURI2;
// console.log(uri);
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);

const brandSchema = new mongoose.Schema({
  _id: String,
  trackingPrefixes: [String], //array of variants of the tracking prefixes
});

const Brand = mongoose.model("Brand", brandSchema);
var allBrands;


/*const userSchema = new mongoose.Schema({
  _id: String,
  username: String,
  firstName: String,
  lastName: { type: String, default: "" },
  password: { type: String, default: "" },
  photoURL: String,
  userHasPassword: {
    type: Boolean,
    default: false
  },
  verified: { type: Boolean, default: false },
  isProUser: { type: Boolean, default: false },
  renews: { type: Date, default: new Date() },
  usageCount: { type: Number, default: 0 },
});
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("testUser", userSchema);
*/


/********* Configure Passport **************/
/*
passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (user, done) {
  done(null, user);
});

//telling passprt to use local Strategy
passport.use(new LocalStrategy(
  function (username, password, done) {
    // console.log("Finding user");
    User.findOne({ _id: username }, function (err, user) {
      // console.log("dons searching for user");
      if (err) { console.log(err); return done(err); }
      if (!user) {
        console.log("incorrect User name");
        return done(null, false, { message: 'Incorrect username.' });
      }

      bcrypt.compare(password, user.password, function (err, result) {
        if (!err) {
          if (!result) {
            console.log("incorrect password");
            return done(null, false, { message: 'Incorrect password.' });
          } else {
            return done(null, user);
          }
        } else {
          // console.log("********some other error *************");
          console.log(err);
        }
      });
    });
  }
));


//telling passport to use Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: FACEBOOK_APP_ID,
  clientSecret: FACEBOOK_APP_SECRET,
  callbackURL: (SERVER) ? "https://triumphcourier.com"+ APP_DIRECTORY+ "/facebookLoggedin" : APP_DIRECTORY + "/facebookLoggedin",  enableProof: true,
  profileFields: ["birthday", "email", "first_name", 'picture.type(large)', "last_name"]
},
  function (accessToken, refreshToken, profile, cb) {
    let userProfile = profile._json;
    // console.log("************ FB Profile *******");
    // console.log(userProfile.picture.data.url);
    User.findOne({ _id: userProfile.email }, function (err, user) {
      if (!err) {
        if (user) {
          console.log("Logged in as ----> " + user._id);
          return cb(err, user);
        } else {
          let newUser = new User({
            _id: userProfile.email,
            username: userProfile.email,
            firstName: userProfile.first_name,
            lastName: userProfile.last_name,
            photoURL: userProfile.picture.data.url,
          });

          newUser.save()
            .then(function () {
              return cb(null, user);
            })
            .catch(function (err) {
              console.log("failed to create user");
              console.log(err);
              return cb(new Error(err));
            });
        }
      } else {
        console.log("***********Internal error*************");
        console.log(err);
        return cb(new Error(err));
      }
    });
  }
));
*/

//telling passport to use GoogleStrategy
/*
passport.use(new GoogleStrategy({
  clientID: CLIENT_ID,
  clientSecret: CLIENT_SECRETE,
  callbackURL: (SERVER) ? "https://triumphcourier.com"+ APP_DIRECTORY+"/googleLoggedin" : APP_DIRECTORY + "/googleLoggedin",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
  function (accessToken, refreshToken, profile, cb) {
    let userProfile = profile._json;
    // console.log(userProfile);
    User.findOne({
      _id: userProfile.email
    }, function (err, user) {
      if (!err) {
        // console.log("logged in");
        if (user) {
          console.log("Logged in as ----> " + user._id);
          return cb(null, user)
        } else {
          console.log("user not found - creating new user");
          let newUser = new User({
            _id: userProfile.email,
            username: userProfile.email,
            firstName: userProfile.given_name,
            lastName: userProfile.family_name,
            photoURL: userProfile.picture
          });

          newUser.save()
            .then(function () {
              return cb(null, user);
            })
            .catch(function (err) {
              console.log("failed to create user");
              console.log(err);
              return cb(new Error(err));
            });
        }
      } else {
        console.log("***********Internal error*************");
        console.log(err);
        return cb(new Error(err));
      }
    });
  }
));


*/


/***********************BUSINESS LOGIC ************************************/

app.route(APP_DIRECTORY + "/")
  .get(function (req, res) {
    // print(tempFilePath);
    cacheBrands();
      res.render("home.ejs", {
        body: new Body("Barcode", "", ""),
      });
  })

app.route(APP_DIRECTORY + "/findBrand/:tracking")
  .get(function (req, res) {
    let tracking = (req.params.tracking).substring(0,7);
    Brand.find({trackingPrefixes:tracking}, "-__v", function(err,foundItem){
      if(!err){
          res.send(foundItem);
      }else{
        res.send("error");
      }
    })
  })


/*
app.route(APP_DIRECTORY + "/fileUpload")
  .post(async function (req, res) {
    if (req.isAuthenticated()) {
      if(allBrands.length<1){
        cacheBrands();
      }
      var form = new formidable.IncomingForm();
      form.parse(req, function (err, fields, files) {
        let upload = files.elicsv;
        let loaded = (fields.loaded) ? "Loaded" : false;
        let attempted = (fields.attempted) ? "Attempted" : false;
        let delivered = (fields.delivered) ? "Delivered" : false;
        let extractFor = fields.extractFor;
        // populateErrors = [];

        let today = new Date;

        if (extractFor != "print") {
          let fileNamePrefix = (extractFor === "roadWarrior") ? "RW - " : "R4M - ";
          let tempFileName = (fileNamePrefix + today.toDateString() + '_' + today.getHours() + '-' + today.getMinutes() + " " + req.user._id + '.xlsx').replace(/ /g, "_");
          getData(upload.path, { loaded: loaded, attempted: attempted, delivered: delivered, extractFor: extractFor }).then(function (processedData) {
            let addresses = processedData.addresses;
            let errors = processedData.errors;
            let read = addresses.length;
            console.log("actual read: " + read);
            console.log("Records read: " + addresses.length);
            // var populateResult;
            if (extractFor === "roadWarrior") {
              console.log("running for ROAD WARIOR");
              populateExcelData(tempFileName, addresses).then((x) =>{
                res.render("excellDownload.ejs", {
                  //uncomment fir local developement
                  // filePath: tempFilePath  + tempFileName,
                  // remote hosting version
                  filePath: (SERVER? APP_DIRECTORY + "/": tempFilePath)  + tempFileName,
                  body: new Body("Download", "", ""),
                  errors: (errors) ? errors: null,
                  user: req.user,
                });
              });
            } else {
              console.log("running for ROUTE 4 ME");
              // console.log("From after processed Data");
              populateExcelDataRoute4Me(tempFileName, addresses).then((x)=>{
                // console.log("Inside Promise prinintg");
                // console.log(x);
                res.render("excellDownload.ejs", {
                  //uncomment fir local developement
                  // filePath: tempFilePath  + tempFileName,
                  // remote hosting version
                  filePath: (SERVER? APP_DIRECTORY + "/": tempFilePath)  + tempFileName,
                  body: new Body("Download", "", ""),
                  errors: (errors) ? errors: null,
                  user: req.user,
                });
              });

            }
          })
        } else {
          let tempFileName = (today.toDateString() + '_' + today.getHours() + '-' + today.getMinutes() + " -PRINT- " + req.user._id + '.xlsx').replace(/ /g, "_");
          // console.log("extract for print");
          getDataForPrint(upload.path, { loaded: loaded, attempted: attempted, extractFor: extractFor }).then(function (addresses) {
            let userName = req.user.firstName + " " + req.user.lastName;
            console.log("Records read: " + addresses.length);
            // console.log(addresses);
            // console.log(userName);
            populateExcelDataForPrint(tempFileName, addresses, userName);
            res.render("stopDisplay.ejs", {
              filePath:  tempFilePath + tempFileName,
              body: new Body("Pick First Stop", "", ""),
              addresses: addresses,
              user: req.user,
            });
          })
        }

      });
    } else {
      res.redirect(APP_DIRECTORY + "/");
    }
  })

app.route(APP_DIRECTORY + "/brandsFileUpload")
  .get(function (req, res){
    if (req.isAuthenticated() || req.hostname.includes("localhost") ) {
      res.render("brandCapture.ejs", {
        body: new Body("Brands Upload - TCS", "", ""),
        allBrands: null,
        updates:null,
        newBrands:null,
        user: (req.user)? req.user : null,
      });
    }else{
      console.log("Unauthenticated Request ");
      res.redirect(APP_DIRECTORY + "/");
    }
  })
  .post(function (req, res) {
    if (req.isAuthenticated() || req.hostname.includes("localhost")) {
      var form = new formidable.IncomingForm();
      form.parse(req, function (err, fields, files) {
        let upload = files.loadXLS;

        getBrandsFromExcelDocument(upload.path).then(async function (data) {

          if (data != "Error Getting Data"){
            console.log("Records read: " + data.length);
            console.log("Checking for and Uploading New Brands ... ");
            let newUpdates = [];
            let newBrandsAdded = [];
            let allBrandsFound = [];
            var processedItem = 0;

            await data.forEach(dataBrand => {
              allBrandsFound.push(dataBrand._id);
              Brand.exists({_id:dataBrand._id}, async function (err,exists) {
                if(exists){
                  // console.log("Brand Already Exists Checking and Updating for Tracking Prefixes");
                  await Brand.updateOne(
                    { _id: dataBrand._id },
                    { $addToSet: { trackingPrefixes: { $each: dataBrand.trackingPrefixes } } },
                    function (err,updatedBrand) {
                      // console.log(err);
                      if(!err){
                        if(updatedBrand.nModified > 0){
                          console.log(dataBrand);
                          console.log(dataBrand._id+" Modified succeffully");
                            newUpdates.push(dataBrand._id);
                        }else{
                          // console.log("No new Prefixes to be added");
                        }
                      }else{
                        console.log("Brand Update Failed");
                        console.log(err);
                      }
                    }
                  )
                }else{
                  console.log("New Brand Found, attempting upload");
                  const newBrand = new Brand(dataBrand);
                  newBrand.save(function(err,savedDoc){
                    if(!err){
                      console.log(newBrand);
                      console.log(newBrand._id+" saved succeffully");
                            newBrandsAdded.push(newBrand._id)
                    }else{
                        console.log("Failed to Save Brand");
                        console.log(err);

                    }
                  });
                }
              });
              
              processedItem++;
              
              if(processedItem >= data.length){
                console.log("Data Length " + data.length);
                console.log("processedItem : "+ processedItem);
                console.log("\n------\nAll Brands Processed");
                console.log(allBrandsFound);
                console.log("\n------\nUpdated Brands");
                console.log(newUpdates);
                console.log("\n------\nNew Brands Added");
                console.log(newBrandsAdded);
                cacheBrands();
                res.render("brandCapture.ejs", {
                  body: new Body("Brands Upload - LSAsistant", "", "Brand Updates Done"),
                  allBrands: allBrandsFound,
                  updates: newUpdates,
                  newBrands: newBrandsAdded,
                  user: (req.user) ? req.user : null,
                });
              }
            });
            
          }else{
            res.render("brandCapture.ejs", {
                  body: new Body("Brands Upload - LSAsistant", "Error Readidng Data", ""),
                  allBrands: null,
                  updates: null,
                  newBrands: null,
                  user: (req.user) ? req.user : null,
                });
          }
        });
      });
    }else{
      console.log("Unauthenticated Request ");
      res.redirect(APP_DIRECTORY + "/");
    }
  });




app.route(APP_DIRECTORY + "/delete")
  .post(function (req, res) {
    let path = req.body.path;
    console.log("File to be deleted: " + path);
    deleteFile(path);
    res.sendStatus(200);
  })

app.route(APP_DIRECTORY + "/profile")
  .get(function (req, res) {
    if (req.isAuthenticated()) {
      res.render("profile", { user: req.user, body: new Body("Account", "", "") });
    } else {
      res.redirect(APP_DIRECTORY + "/");
    }
  })


*/

  /****************** Authentication *******************/

/*
app.route(APP_DIRECTORY + "/login")
  .get(function (req, res) {
    if (req.isAuthenticated()) {
      // console.log("Authenticated Request");
      res.redirect(APP_DIRECTORY + "/")
    } else {
      // console.log("Unauthorized Access, Please Login");
      res.render("login", {
        body: new Body("Login", "", ""),
        login: null,
        user: req.user,
      });
    }
  })
  .post(function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {
      // console.log(req.body.password);
      // console.log(req.body.username);
      console.log("logged in as ---> " + user._id);
      // console.log(err);
      if (err) {
        return next(err);
      }
      // Redirect if it fails
      if (!user) {
        return res.render('login', {
          body: new Body("Login", info.message, ""),
          login: req.body.username,
          user: null,
        });
      }
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        // Redirect if it succeeds
        return res.redirect(APP_DIRECTORY + '/');
      });
    })(req, res, next);
  });

app.get(APP_DIRECTORY + '/auth/google', passport.authenticate('google', {
  // scope: ['profile']
  scope: [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ]
}));

app.get(APP_DIRECTORY + '/auth/facebook', passport.authenticate('facebook', {
  scope: 'email'
})); 

app.route(APP_DIRECTORY + "/facebookLoggedin")
  .get(function (req, res, next) {
    passport.authenticate('facebook', function (err, user, info) {
      if (err) {
        console.log(err);
        return next(err);
      }
      // Redirect if it fails
      if (!user) {
        return res.render('login', {
          body: new Body("Login", "", "Account Created successfully, Please log in again to continue"),
          login: null,
          user: req.user,
        });
      }
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        // Redirect if it succeeds
        return res.redirect(APP_DIRECTORY + '/');
      });
    })(req, res, next);
  });

app.route(APP_DIRECTORY + "/googleLoggedin")
  .get(function (req, res, next) {
    passport.authenticate('google', function (err, user, info) {
      if (err) {
        return next(err);
      }
      // Redirect if it fails
      if (!user) {
        return res.render('login', {
          body: new Body("Login", "", "Account Created successfully, Please log in again to continue"),
          login: null,
          user: req.user,
        });
      }
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        // Redirect if it succeeds
        return res.redirect(APP_DIRECTORY + '/');
      });
    })(req, res, next);
  });

app.route(APP_DIRECTORY + "/logout")
  .get(function (req, res) {
    req.logout();
    console.log("Logged Out");
    res.redirect(APP_DIRECTORY + "/");

  });

app.route(APP_DIRECTORY + "/register")
  .get(function (req, res) {
    if (req.isAuthenticated()) {
      // console.log("Authenticated Request");
      res.redirect(APP_DIRECTORY + "/")
    } else {
      // console.log("Unauthorized Access, Please Login");
      res.render("register", {
        body: new Body("Register", "", ""),
        user: null,
      });
    }
  })
  .post(function (req, res) {
    const user = new User({
      _id: req.body.username,
      firstName: req.body.firstName,
      password: req.body.password,
      photoURL: "",
      userHasPassword: true,
    })
    let hahsPassword;
    // console.log(user.password);
    // console.log(req.body.confirmPassword);
    // console.log(user);
    if (user.password === req.body.confirmPassword) {
      bcrypt.hash(req.body.password, SALTROUNDS, function (err, hash) {
        if (!err) {
          user.password = hash;
          // console.log(user);
          User.exists({
            _id: user._id
          }, function (err, exists) {
            if (exists) {
              res.render("register", {
                body: new Body("Register", "email is aready in use", ""),
                user: user,
              });
            } else {

              user.save(function (err, savedObj) {
                // console.log(err);
                if (!err) {
                  // console.log(savedObj);
                  res.redirect(APP_DIRECTORY + "/login");
                } else {

                }
              })
            }
          });
        } else {
          // console.log(user);
          // console.log(err);
          res.render("register", {
            body: new Body("Register", "Unable to complete registration (error: e-PWD)", ""),
            user: user,
          });
        }
      });
    } else {
      res.render("register", {
        body: new Body("Register", "Passwords do not match", ""),
        user: user,
      });
    }
  })

app.route(APP_DIRECTORY + "/usernameExist")
  .post(function (req, res) {
    // console.log("username to search ---> "+req.body.username);
    User.exists({
      _id: req.body.username
    }, function (err, exists) {
      res.send(exists);
    })
  })

app.route(APP_DIRECTORY + "/deleteAccess")
  .get(function (req, res) {
    let provider = req.params.provider;
    if (provider === provider) {
      res.render("accessDeletion", {
        body: new Body("Delete Access", "", ""),
        user: req.user
      });
    }
  })
  .post(function (req, res) {
    User.deleteOne({
      _id: req.user.username
    }, function (err, deleted) {
      console.log(err);
      console.log(deleted);
      res.redirect(APP_DIRECTORY + "/logout")
    })
  })

app.get(APP_DIRECTORY + "/hereApiKey", function (req, res) {
  if (req.isAuthenticated()) {
    res.send(HEREAPI);
  } else {
    res.send("89EWE^567AMEDR4138%^#MAN@%^#J");
  }
})

*/


app.listen(process.env.PORT || 3035, function () {
  clearTempFolder();
  cacheBrands();
  console.log("Barcode is live on port " + ((process.env.PORT) ? process.env.PORT : 3035));
  // print("./")
});



/************ helper function ***************/

async function cacheBrands(){
  allBrands = await Brand.find({},"-__v");
  stringBrands = JSON.stringify(allBrands);
  // reCon = JSON.parse(stringBrands);
  // console.log(reCon);

  fs.mkdir(tempFilePath, (err) => {
      if (err) {
        // console.log(err.message);
        // console.log(err.code);
        if (err.code === "EEXIST") {
          console.error("Directory ALREADY Exists.");
           fs.writeFile(tempFilePath + 'brands.txt', stringBrands, err => {
              if (err) {
                console.error(err);
              }else{
                console.log("Brands written to file");
              }
            }); 
        } else {
          console.error(err.code);;
          console.error(err);;
        }
      }else{
        fs.writeFile(tempFilePath + 'brands.txt', stringBrands, err => {
          if (err) {
            console.error(err);
          }else{
            console.log("Brands written to file");
          }
        }); 
        console.log("'/tmp' Directory was created.");
      }
    });
 
}

async function clearTempFolder(){
  fs.readdir(tempFilePath, (err, files) => {
  if (err) {
    console.error(err.code + " Failed to clear temp folder");
  }else{
    console.error(files);
    for (const file of files) {
      if(file.startsWith("R4M") || file.startsWith("RW") || file.startsWith("bra")){
        fs.unlink(path.join(tempFilePath, file), (err) => {
          if (err) throw err; 
        });
      }
    }
  }
});
}

function Body(title, error, message) {
  this.title = title;
  this.error = error;
  this.message = message;
  this.domain = APP_DIRECTORY;
  this.publicFolder = PUBLIC_FOLDER;
  this.publicFiles = PUBLIC_FILES;
}
