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
  fs.writeFile(tempFilePath + 'brands.txt', stringBrands, err => {
  if (err) {
    console.error(err);
  }
  // file written successfully
  console.log("Brands written to file");
});
}

async function clearTempFolder(){
  fs.readdir(tempFilePath, (err, files) => {
  if (err) throw err;

  for (const file of files) {
    if(file.startsWith("R4M") || file.startsWith("RW") || file.startsWith("bra")){
      fs.unlink(path.join(tempFilePath, file), (err) => {
        if (err) throw err; 
      });
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