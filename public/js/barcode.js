const domain = $('#domain').attr('domain');

window.onload = (event) => {
  $("#barcodeNumber").focus();
  // alert("loaded");
  checkAndTrack();
  
};

function render(){
  field = $("#barcodeNumber");
  text = (field.val()).toUpperCase();
  
  if(text){
    $("#printButton").removeClass("disabled");
    
    if(text.length > 6){
      if(text.length > 10){
      $("#trackPackageBtn").removeClass("disabled")
    }else{
      $("#trackPackageBtn").addClass("disabled")
    }
      findBrand(text).then((brand) => {
       if(brand != "-- Server Error --"){
            JsBarcode("#barcode", text, {
              width:(text.length > 14)? 2 : 2.4,
              font: "Arial",
              marginTop: 50,
              height:120,
              displayValue: true
            });

            $("#barcodeBrand").val(brand);
            var canvas = $("#barcode")[0];
            const ctx = canvas.getContext("2d");
          
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.fillText(brand ,-100,42);
            
        }else{
          JsBarcode("#barcode", text, {
              width:(text.length > 14)? 2 : 2.4,
              font: "Arial",
              marginTop: 50,
              height:120,
              displayValue: true
          });
        }
      })
    }

  }else{
    $("#printButton").addClass("disabled");
    JsBarcode("#barcode", " ", {
      width: 1.4,
      lineColor: "#000",
      height:25,
      displayValue: false
    });
  }
    
}

function renderModal(){
  field = $("#barcodeNumber");
  text = (field.val()).toUpperCase();
  brand = $("#barcodeBrand").val();
  
  if(text){
    $("#printButton").removeClass("disabled");
    JsBarcode("#barcodeModal", text, {
      font: "Arial",
      width:(text.length > 18)? 1.4 : 1.7,
      marginTop: 50,
      height:100,
      displayValue: true
    });
    // if(text.length > 6){
      $("#barcodeBrand").val(brand);
      var canvas = $("#barcodeModal")[0];
      const ctx = canvas.getContext("2d");
    
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(brand ,-100,42);
      
  }else{
    $("#printButton").addClass("disabled");
    JsBarcode("#barcodeModal", " ", {
      lineColor: "#000",
      // width:4,
      height:45,
      displayValue: false
    });
  }
    
}

function transferDescription(evt){
  let descriptionField  = $(evt) 
  $("#description").val(descriptionField.val())
}

function clearNameField() {
  $("#barcodeDescription").val("");
   $("#description").val("");
   render();
   renderModal();
}

function printBarcode() {
  if($("#description").val().length < 1){
    $("#description").val(" ");
  }
  window.print();
}

function downloadImage() {
  var name = " ";
  if($("#description").val().length > 0){
    name = ($("#description").val()).toUpperCase();;
  }
  
  var origanlCanvas = $("#barcode")[0];
  var canvas = $("#barcode")[0];
  const ctx = canvas.getContext("2d");


  
  ctx.font = "22px Arial";
  ctx.textAlign = "center";
  ctx.fillText(name ,-110,24);
  // console.log(ctx);
  // console.log(ctx.width);

  var dt = canvas.toDataURL('image/jpeg');
  $("#downloadLink").attr("download", name) ;
  $("#downloadLink").attr("href", dt) ;
};

function search(evt) {
  tracking = ($(evt).val()).toUpperCase();

  if(tracking.length > 6){
    
    findBrand(tracking).then((foundBrands) => {
    console.log(foundBrands);
    $("#brand").text(foundBrands)
    }).catch((err) => {
      console.log(err);
      $("#brand").text(err)
    })
  }
}

function findBrand(barcode){
  return new Promise(function (resolve, reject){
      $.get(domain + "/findBrand/"+barcode, function (data,status) {
        if(data){
          if(data.length > 0){
            resolve(data[0]._id);
          }else{
            resolve("#- UNREGITERED BRAND -#");
          }
        }else{
            reject("-- Server Error --");

        }
      })
      // reject("/--");
  });
}

function deleteFile(path){
  $.post(domain + "/delete", {path:path}, function(status){
    if(200){
      if(!path.includes('R4M'))
      $("#roadWarrioirLink").fadeIn("fast").fadeOut("fast").fadeIn("slow");
      return console.log("sucessfull registered deletion");
    }
  });
}

function setTrackingImage(evt) {
  imageURL = $(evt).attr("imgurl");
  console.log(imageURL);
  $("#trackingPicture").attr("src",imageURL);
}

function trackPackage() {
  let tracking = $("#barcodeNumber").val().trim();
  if(tracking.length > 10){
    getTrackingnInfo(tracking).then(function (details) {
      if(details != 404){
        console.log(details);
        let detailsHtml = "";
        details.forEach(detail => {  
          detailsHtml = detailsHtml + '<a class="list-group-item list-group-item-action" aria-current="true">'+
            '<div class="d-flex w-100 justify-content-between">'+
              '<h6 class="mb-1">'+ detail.EventType +'</h6>'+
              '<small>'+ new Date(detail.DateTime).toLocaleString() +'</small>'+
            '</div>';
          text = "";
          if(detail.Signature){
            text = '<p class="mb-1">'+detail.EventLongText+'. | '+ (detail.Location) +': ' + (detail.Signature)+' <span><i onclick="setTrackingImage(this)" data-bs-toggle="modal"'+
                'data-bs-target="#trackingPictureModal" imgURL="'+detail.SignatureImagePath+'" class="bi bi-camera"></i></span>.</p>';
          }else if(detail.PhotoPath){
            text = '<p class="mb-1">'+detail.EventLongText+'. | '+ (detail.Location) +' <span><i onclick="setTrackingImage(this)" data-bs-toggle="modal"'+
                'data-bs-target="#trackingPictureModal" imgURL="'+detail.PhotoPath+'" class="bi bi-camera"></i></span>.</p>';
          }else{
            text = '<p class="mb-1">'+detail.EventLongText+'.</p>';
          }
          detailsHtml = detailsHtml + text;
          
          // '<p class="mb-1">'+detail.EventLongText+'. | '+ (detail.Location?detail.Location +': ' : '') +'  '(detail.Signature? detail.Signature : '') + ' ' + (detail.SignatureImagePath+ '' : (detail.photo) )+' <span><i class="bi bi-camera"></i></span>.</p>'+
            
          detailsHtml = detailsHtml +'<small>'+detail.City +', '+detail.State+', '+detail.PostalCode+'</small>'+
          '</a>';
        });
        $("#trackingDetails").html(detailsHtml);
      }else{
        console.log("Didnt find Shit");
      }

      /** 
     
      **/
    })
  }
}

function getTrackingnInfo(trackingNumber){
  return new Promise(function (resolve, reject){
    $.get("https://t.lasership.com/Track/"+trackingNumber+"/json", function(details,status){
      if(details){
        resolve(details.Events)
      }else{
        resolve("ERR: Cant find info")
      }
    }).catch((err) =>{
      if(err.status === 404){
        resolve(err.status); 
      }else{
        console.log("Something Happened");
      }
    })
  });
}


function checkAndTrack() {
  tracking = $("#barcodeNumber").val();
  if(tracking && tracking.length > 6){
    $("#trackPackageBtn").removeClass("disabled")
    $("#trackPackageBtn").click();
    render();
  }
}

// function selectStop(evt){
//   let element = $(evt);
//   stop = JSON.parse(element.attr("stop"));
//   $($('[stop]')).removeClass("active");
//   element.addClass("active");
//   $("#stopSelected").html(stop.Street + ", " + stop.City)
//   $($('[firstStop]')).attr("firstStop",""+stop.Street + ", " + stop.City);
//   $("#optimizeButton").fadeIn("fast").fadeOut("fast").fadeIn("slow");
// }

