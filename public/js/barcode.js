const domain = $('#domain').attr('domain');

window.onload = (event) => {
  $("#barcodeNumber").focus();
  // alert("loaded");
  
};

function render(){
  field = $("#barcodeNumber");
  text = (field.val()).toUpperCase();
  if(text){
    $("#printButton").removeClass("disabled");
    
    if(text.length > 6){
      findBrand(text).then((brand) => {
       if(brand != "-- Server Error --"){
            $("#barcodeBrand").val(brand);
            var canvas = $("#barcode")[0];
            const ctx = canvas.getContext("2d");
          
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.fillText(brand ,-100,42);
            JsBarcode("#barcode", text, {
            width:(text.length > 18)? 1.8 : 2.2,
            font: "Arial",
            marginTop: 50,
            height:200,
            displayValue: true
          });
        }else{
          JsBarcode("#barcode", text, {
            width:(text.length > 18)? 1.8 : 2.2,
            font: "Arial",
            marginTop: 50,
            height:200,
            displayValue: true
          });
        }
      })
    }

  }else{
    $("#printButton").addClass("disabled");
    JsBarcode("#barcode", " ", {
      lineColor: "#000",
      height:45,
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





// function selectStop(evt){
//   let element = $(evt);
//   stop = JSON.parse(element.attr("stop"));
//   $($('[stop]')).removeClass("active");
//   element.addClass("active");
//   $("#stopSelected").html(stop.Street + ", " + stop.City)
//   $($('[firstStop]')).attr("firstStop",""+stop.Street + ", " + stop.City);
//   $("#optimizeButton").fadeIn("fast").fadeOut("fast").fadeIn("slow");
// }
