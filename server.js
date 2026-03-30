const SERVER = !(process.execPath.includes("C:"));//process.env.PORT;
if (!SERVER){
  require("dotenv").config();
}



const MONGOPASSWORD = process.env.MONGOPASSWORD;
const MONGOUSER = process.env.MONGOUSER;
const MONGOURI2 = process.env.MONGOURI2;


const SECRETE = process.env.SECRETE;

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
const path = require("path");
const mongoose = require("mongoose");
const portfinder = require("portfinder");
const fsp = fs.promises;

// Configure app to user EJS abd bodyParser
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static(path.join(__dirname, "public", "dist")));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(tempFilePath));
app.use(express.static("."));
if (APP_DIRECTORY) {
  app.use(APP_DIRECTORY, express.static(path.join(__dirname, "public", "dist")));
  app.use(APP_DIRECTORY, express.static(path.join(__dirname, "public")));
}
app.use(express.json());


//Forcing https so as to allow frontend geolocation work properly



// Mongoose Configuration and Setup
const uri = "mongodb+srv://" + MONGOUSER + ":" + MONGOPASSWORD + MONGOURI2;
// console.log(uri);
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).catch(function (err) {
  console.error(outputDate() + "Initial MongoDB connect failed: " + err.message);
});

mongoose.connection.on("error", function (err) {
  console.error(outputDate() + "MongoDB connection error: " + err.message);
});

mongoose.connection.once("open", function () {
  console.error(outputDate() + "MongoDB connected.");
});

const brandSchema = new mongoose.Schema({
  _id: String,
  trackingPrefixes: [String], //array of variants of the tracking prefixes
});

const Brand = mongoose.model("Brand", brandSchema);
var allBrands;
let stringBrands = "[]";
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
const BASE_PORT = Number(process.env.PORT) || 3035;
const MAX_PORT_RETRIES = 20;




/***********************BUSINESS LOGIC ************************************/
app.route(APP_DIRECTORY + "/")
  .get(function (req, res) {
    // print(tempFilePath);
      res.render("home.ejs", {
        body: new Body("Home", "", ""),
        tracking: null,
      });
  })

app.route(APP_DIRECTORY + "/track/:tnumber")
  .get(function (req, res) {
    // print(tempFilePath);
      if(req.params.tnumber){
        tracking = req.params.tnumber;
        // console.log(tracking);
        res.render("home.ejs", {
          body: new Body("Home", "", ""),
          tracking: tracking,
        });
      }else{
        res.render("home.ejs", {
          body: new Body("Home", "", ""),
          tracking: null,
        });
      }
  })

app.route(APP_DIRECTORY + "/findBrand/:tracking")
  .get(function (req, res) {
    let tracking = (req.params.tracking).substring(0,7);

    if (mongoose.connection.readyState !== 1) {
      if (Array.isArray(allBrands) && allBrands.length) {
        const fallback = allBrands.filter(function (brand) {
          return Array.isArray(brand.trackingPrefixes) && brand.trackingPrefixes.includes(tracking);
        });
        res.send(fallback);
        return;
      }
      res.send([]);
      return;
    }

    Brand.find({trackingPrefixes:tracking}, "-__v", function(err,foundItem){
      if(!err){
          res.send(foundItem);
      }else{
        res.send("error");
      }
    })
  })


process.on("unhandledRejection", function (reason) {
  console.error(outputDate() + "Unhandled promise rejection:", reason);
});

process.on("uncaughtException", function (err) {
  console.error(outputDate() + "Uncaught exception:", err);
});

startServerWithFallback(BASE_PORT, MAX_PORT_RETRIES);


/************ helper function ***************/

async function cacheBrands(){
  if ((Date.now() - cacheTime) < CACHE_TTL_MS && allBrands) {
    return allBrands;
  }

  if (mongoose.connection.readyState !== 1) {
    console.error(outputDate() + "Skipping brands cache refresh: MongoDB is not connected.");
    return allBrands || [];
  }

  try {
    allBrands = await Brand.find({}, "-__v").maxTimeMS(5000);
    stringBrands = JSON.stringify(allBrands);
    cacheTime = Date.now();
    await fsp.mkdir(tempFilePath, { recursive: true });
    await fsp.writeFile(path.join(tempFilePath, "brands.txt"), stringBrands);
    console.error(outputDate() + "Brands cache refreshed.");
    return allBrands;
  } catch (err) {
    console.error(outputDate() + "Failed to refresh brands cache: " + err.message);
    return allBrands || [];
  }
}

async function keepAlive(){
  const interval = 3600000;
  let count = 1;
  console.error(outputDate()+"Keep Alive Service Initiated, [Interval: "+ interval/60000+" mins]");
  setInterval(function () {
    console.log(outputDate() + "Keep Alive Ping: " + count++);
  }, interval);
}

async function clearTempFolder(){
  try {
    const files = await fsp.readdir(tempFilePath);
    const removable = files.filter(function (file) {
      return file.startsWith("R4M") || file.startsWith("RW") || file === "brands.txt";
    });

    await Promise.all(removable.map(function (file) {
      return fsp.unlink(path.join(tempFilePath, file));
    }));
    console.error(outputDate() + "Temp folder cleanup complete.");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(outputDate() + "Temp folder not found yet, skipping cleanup.");
      return;
    }
    console.error(outputDate() + "Failed to clear temp folder: " + err.message);
  }
}

async function startServerWithFallback(startPort, maxRetries) {
  const maxPort = startPort + maxRetries;
  portfinder.basePort = startPort;
  portfinder.highestPort = maxPort;

  let selectedPort;
  try {
    selectedPort = await portfinder.getPortPromise();
  } catch (err) {
    console.error(outputDate() + "No free port found between " + startPort + " and " + maxPort + ".");
    process.exit(1);
    return;
  }

  if (selectedPort !== startPort) {
    console.error(outputDate() + "Port " + startPort + " is busy. Switching to port " + selectedPort + ".");
  }

  const server = app.listen(selectedPort, async function () {
    console.error(outputDate() + "Barcode is live on port " + selectedPort);
    keepAlive();
    await clearTempFolder();
    await cacheBrands();
    setInterval(function () {
      cacheBrands();
    }, CACHE_TTL_MS);
  });

  server.on("error", function (err) {
    if (err.code === "EADDRINUSE" && selectedPort < maxPort) {
      console.error(outputDate() + "Port " + selectedPort + " became busy during startup. Retrying.");
      startServerWithFallback(selectedPort + 1, maxPort - (selectedPort + 1));
      return;
    }

    console.error(outputDate() + "Server startup error: " + err.message);
    process.exit(1);
  });
}

function outputDate() {
  return (new Date().toLocaleString()) + " >> ";
}

function Body(title, error, message) {
  this.title = title;
  this.error = error;
  this.message = message;
  this.domain = APP_DIRECTORY;
  this.publicFolder = PUBLIC_FOLDER;
  this.publicFiles = PUBLIC_FILES;
}