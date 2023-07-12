const domain = $('#domain').attr('domain');

window.onload = (event) => {
  $("#barcodeNumber").focus();
  // alert("loaded");
  
};

function render(evt){
  field = $(evt);
  text = (field.val()).toUpperCase();
  if(text){
    $("#printButton").removeClass("disabled");
    JsBarcode("#barcode", text, {
      // lineColor: "#7777",
      width:(text.length > 20)? 1.2 : 1.7,
      height:80,
      displayValue: true
    });
  }else{
    $("#printButton").addClass("disabled");
    JsBarcode("#barcode", " ", {
      lineColor: "#9999",
      // width:4,
      height:80,
      displayValue: false
    });
  }
    
}

function transferDescription(evt){
  let descriptionField  = $(evt) 
  $("#description").val(descriptionField.val())
}

function printBarcode() {
  // var printContents = document.getElementById(divName).innerHTML;
  var printContents = $("#printArea").html();
  var originalContents = $("body").html();
  // var originalContents = $("#originalDoc").html();
  let body = $("body");
  
  console.log(printContents);
  console.log(originalContents);
  
  // body.html(printContents);
  window.print();
  // body.html(originalContents);


}

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
