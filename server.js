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

// Configure app to user EJS abd bodyParser
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(express.static(tempFilePath));
app.use(express.static("."));
app.use(express.json());


//Forcing https so as to allow frontend geolocation work properly



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
        body: new Body("Home", "", ""),
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
  keepAlive();
  clearTempFolder();
  cacheBrands();
  console.error(outputDate() + " Barcode is live on port " + ((process.env.PORT) ? process.env.PORT : 3035));
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

async function keepAlive(){
  count = 0;
  startDate = new Date(2023,10,03);
  while (startDate.getDate() < 5) {
    console.log(outputDate() + "Starting a new loop cycle");
    await new Promise( function(resolve,reject){
      setTimeout(resolve, 3600000)//1hr
    });
   
      
    // await new Promise( resolve => setTimeout(() => {
    //   console.error(new Date().toLocaleString() + " >> Keep Alive Service Print: " + count)
    //   }, 3000000); //5Mins
    // )
  }
}

async function clearTempFolder(){
  fs.readdir(tempFilePath, (err, files) => {
  if (err) {
    console.error(err.code + " Failed to clear temp folder");
  }else{
    // console.error(files);
    for (const file of files) {
      if(file.startsWith("R4M") || file.startsWith("RW") || file.startsWith("brands.txt")){
        fs.unlink(path.join(tempFilePath, file), (err) => {
          if (err) throw err; 
        });
      }
    }
  }
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