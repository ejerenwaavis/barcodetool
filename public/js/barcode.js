const domain = $('#domain').attr('domain');
const brandLookupCache = new Map();

function debounce(fn, wait) {
  let timeoutId;
  return function () {
    const args = arguments;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(function () {
      fn.apply(null, args);
    }, wait);
  };
}

function drawCanvasLabel(canvasSelector, label, x, y, font) {
  const canvas = $(canvasSelector)[0];
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, 48);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.fillText(label, x, y);
}

window.onload = (event) => {
  $("#barcodeNumber").focus();
  const debouncedRender = debounce(render, 180);
  const debouncedSearch = debounce(function (evt) {
    search(evt.target);
  }, 220);

  $("#barcodeNumber").on("input", debouncedRender);
  $("#brandFinderInput").on("input", debouncedSearch);
  $("#barcodeDescription").on("input", function () {
    transferDescription(this);
  });

  $('#delimeterText').blur(function() {
    $(this).addClass('collapsed');
  });
  $('#delimeterText').focus(function() {
    $(this).removeClass('collapsed');
  });
  checkAndTrack();
};

function render(){
  const field = $("#barcodeNumber");
  const text = (field.val()).toUpperCase().trim();
  
  if(text){
    $("#printArea").show();
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
            drawCanvasLabel("#barcode", brand, -100, 42, "16px Arial");
            
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
    $("#printArea").hide();
    $("#printButton").addClass("disabled");
    JsBarcode("#barcode", " ", {
      width: 1.4,
      lineColor: "#000",
      height:25,
      displayValue: false
    });
  }
    
}

async function processBatch(){
  const fieldText = $('#barcodesBatchText').val().toUpperCase();
  const barcodeDisplay = $("#batchBarcodeDisplay");
  
  if (barcodeDisplay.hasClass("scroll-mode")) {
    resetAutoScroll();
  }

  barcodeDisplay.empty();
  let count = 0;

  const lines = fieldText.split(/\n/);
  const trackingData = [];

  lines.forEach(line => {
      const [tracking, ...addressArray] = line.split(/,\s*/);
      const address = addressArray.join(', ');
      trackingData.push({ tracking: (tracking || "").trim(), address });
  });

  const html = [];
  for (const element of trackingData) {
    if(element.tracking){
      count = count + 1;
      html.push(`<div class="label-card"><p class="label-index">Label ${count}</p><canvas id="bbc-${element.tracking}-${count}"></canvas></div>`);
    }
  }

  if (!count){
    barcodeDisplay.html('<p class="label-empty">No valid entries found. Add one barcode per line.</p>');
    $("#bulkPrintBtn").addClass("disabled");
    $("#bulkPdfBtn").addClass("disabled");
    $("#autoScrollBtn").addClass("disabled");
    $("#bulkLabelCount").text("");
    return;
  }

  barcodeDisplay.html(html.join(""));

  let i = 0;
  for (const element of trackingData) {
    if (element.tracking) {
      i++;
      const canvasSel = `#bbc-${element.tracking}-${i}`;
      JsBarcode(canvasSel, element.tracking, {
        width:(element.tracking.length > 14)? 2 : 2.4,
        font: "Arial",
        marginTop: 50,
        height:60,
        displayValue: true
      });
      if (element.address) {
        drawCanvasLabel(canvasSel, element.address, -100, 42, "16px Arial");
      }
    }
  }

  $("#bulkPrintBtn").removeClass("disabled");
  $("#bulkPdfBtn").removeClass("disabled");
  $("#autoScrollBtn").removeClass("disabled");
  $("#bulkLabelCount").text(count + (count === 1 ? " label" : " labels"));
  showToast(count + (count === 1 ? " label generated" : " labels generated"), "ok");
}

function printBulkLabels(){
  if ($("#bulkPrintBtn").hasClass("disabled")) return;
  window.print();
}

function exportBulkPdf(){
  if ($("#bulkPdfBtn").hasClass("disabled")) return;
  if (typeof window.jspdf === "undefined") {
    showToast("PDF library failed to load", "err");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const cols = 2;
  const gap = 18;
  const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = 110;
  let x = margin, y = margin, col = 0;

  $("#batchBarcodeDisplay canvas").each(function () {
    if (y + cellH > pageH - margin) {
      doc.addPage();
      x = margin; y = margin; col = 0;
    }
    const canvas = this;
    const targetW = Math.min(cellW, canvas.width);
    const targetH = canvas.height * (targetW / canvas.width);
    doc.setDrawColor(210);
    doc.roundedRect(x, y, cellW, cellH, 6, 6);
    doc.addImage(canvas.toDataURL("image/png"), "PNG", x + (cellW - targetW) / 2, y + (cellH - targetH) / 2, targetW, targetH);

    col++;
    if (col >= cols) {
      col = 0; x = margin; y += cellH + gap;
    } else {
      x += cellW + gap;
    }
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  doc.save("labels-" + stamp + ".pdf");
  showToast("PDF saved", "ok");
}

async function processDelimeter() {
  var input = $('#delimeterText').val().trim();
  var lines = input.split('\n');
  var output = '';

  lines.forEach(function(line) {
    if(line){
      var parts = line.split(' - ');
      var name = parts[0].trim();
      var zipCodes = parts[1].trim().split(/\s+/).join('\n');
      var score = parts[2].trim();
      
      output += name + ' - ' + score + '\n' + zipCodes + '\n\n';
    }
  });

  $('#outputText').text(output.trim());
  if (output.trim()) {
    showToast("Reformatted", "ok");
  }
}

function copyDelimeterOutput(){
  const text = $('#outputText').text();
  if (!text.trim()) {
    showToast("Nothing to copy yet", "warn");
    return;
  }
  navigator.clipboard.writeText(text).then(function () {
    showToast("Copied to clipboard", "ok");
  }).catch(function () {
    showToast("Copy failed \u2014 select the text manually", "err");
  });
}

/* -------------------------------------------------- shared toast -------------------------------------------------- */

let toastTimer;
function showToast(message, kind){
  const el = $("#appToast");
  if (!el.length) return;
  el.text(message);
  el.removeClass("ok warn err");
  if (kind) el.addClass(kind);
  el.addClass("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    el.removeClass("show");
  }, 2200);
}

function renderModal(){
  const field = $("#barcodeNumber");
  const text = (field.val()).toUpperCase().trim();
  const brand = $("#barcodeBrand").val();
  
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
      drawCanvasLabel("#barcodeModal", brand, -100, 42, "14px Arial");
      
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
  const tracking = ($(evt).val()).toUpperCase();

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
      const prefix = barcode.substring(0, 7);
      if (brandLookupCache.has(prefix)) {
        resolve(brandLookupCache.get(prefix));
        return;
      }

      $.get(domain + "/findBrand/"+barcode, function (data,status) {
        if(data){
          if(data.length > 0){
            brandLookupCache.set(prefix, data[0]._id);
            resolve(data[0]._id);
          }else{
            brandLookupCache.set(prefix, "#- UNREGITERED BRAND -#");
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
  const imageURL = $(evt).attr("imgurl");
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
  const tracking = $("#barcodeNumber").val();
  if(tracking && tracking.length > 6){
    $("#trackPackageBtn").removeClass("disabled")
    $("#trackPackageBtn").click();
    render();
  }
}
let scrollInterval = null;
function toggleAutoScroll() {
  const container = $("#batchBarcodeDisplay");
  const btn = $("#autoScrollBtn");
  const speedSelect = $("#scrollSpeed");
  
  if (btn.hasClass("disabled")) return;

  if (container.hasClass("scroll-mode") && scrollInterval) {
    // Stop scrolling but keep the view so user can manually swipe
    clearInterval(scrollInterval);
    scrollInterval = null;
    btn.text("Resume Scroll").removeClass("btn-accent").addClass("btn-secondary");
  } else if (container.hasClass("scroll-mode")) {
    // Resume scrolling
    btn.text("Stop Scroll").removeClass("btn-secondary").addClass("btn-accent");
    startScrollLoop(container, btn, speedSelect);
  } else {
    // Start scrolling (first time)
    container.addClass("scroll-mode");
    speedSelect.prop("disabled", false);
    btn.text("Stop Scroll").removeClass("btn-secondary").addClass("btn-accent");
    startScrollLoop(container, btn, speedSelect);
  }
}

function startScrollLoop(container, btn, speedSelect) {
  clearInterval(scrollInterval);
  scrollInterval = setInterval(() => {
    const speed = parseFloat(speedSelect.val()) || 2.5;
    const elem = container[0];
    elem.scrollTop += speed;
    
    // Check if we hit the bottom
    if (elem.scrollTop + elem.clientHeight >= elem.scrollHeight - 2) {
       clearInterval(scrollInterval);
       scrollInterval = null;
       btn.text("Done (Reset)").removeClass("btn-accent").addClass("btn-secondary");
       // When they click Done (Reset), we should probably reset the whole view
       btn.off('click').on('click', resetAutoScroll);
    }
  }, 20); // ~50fps
}
function resetAutoScroll() {
  const container = $("#batchBarcodeDisplay");
  const btn = $("#autoScrollBtn");
  const speedSelect = $("#scrollSpeed");
  clearInterval(scrollInterval);
  scrollInterval = null;
  container.removeClass("scroll-mode");
  container[0].scrollTop = 0;
  speedSelect.prop("disabled", true);
  btn.text("Auto Scroll").removeClass("btn-accent").addClass("btn-secondary");
  // ensure we unbind the custom reset click and bind the toggle
  btn.off('click').on('click', toggleAutoScroll);
}
