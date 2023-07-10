const domain = $('#domain').attr('domain');

window.onload = (event) => {

  // alert("loaded");
  
};

function render(evt){
  field = $(evt);
  text = (field.val()).toUpperCase();
  if(text){
    JsBarcode("#barcode", text, {
      // lineColor: "#7777",
      width:(text.length > 20)? 1.2 : 1.7,
      height:80,
      displayValue: true
    });
  }else{
    JsBarcode("#barcode", " ", {
      lineColor: "#9999",
      // width:4,
      height:80,
      displayValue: false
    });
  }
    
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
