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
    JsBarcode("#barcode", text, {
      // lineColor: "#7777",
      width:(text.length > 20)? 1.2 : 1.7,
      marginTop: 50,
      height:100,
      displayValue: true
    });

  }else{
    $("#printButton").addClass("disabled");
    JsBarcode("#barcode", " ", {
      lineColor: "#9999",
      // width:4,
      height:85,
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


  
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.fillText(name ,-110,35);
  console.log(ctx);
  console.log(ctx.width);

  var dt = canvas.toDataURL('image/jpeg');
  $("#downloadLink").attr("download", name) ;
  $("#downloadLink").attr("href", dt) ;
};

function search(evt) {
  tracking = ($(evt).val()).toUpperCase();

  if(tracking.length > 6){
    $.get(domain + "/findBrand/"+tracking, function (data) {
      if(data){
        if(data.length > 0){
          $("#brand").text(data[0]._id)
        }else{
          $("#brand").text("-- No Matches Found --")
        }
      }
    })
  }
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
