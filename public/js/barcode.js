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
  initPreloadScan();
  initConsoleNavigation();
};

function switchToTab(tabId) {
  const tabEl = document.getElementById(tabId);
  if (tabEl) {
    if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
      bootstrap.Tab.getOrCreateInstance(tabEl).show();
    } else if (typeof $ !== 'undefined' && $(tabEl).tab) {
      $(tabEl).tab('show');
    }
    syncTabUI(tabId);
  }
}

function syncTabUI(activeTabId) {
  // Update top segmented tabs
  $('.tabs .tab').removeClass('active').attr('aria-selected', 'false');
  $('#' + activeTabId).addClass('active').attr('aria-selected', 'true');

  // Scroll active tab into view if needed
  const activeTabEl = document.getElementById(activeTabId);
  if (activeTabEl && typeof activeTabEl.scrollIntoView === 'function') {
    try {
      activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } catch(e) {}
  }

  // Update bottom nav
  $('.navbar .navitem, .navbar .navitem-center').removeClass('active');
  $(`.navbar [data-tab="${activeTabId}"]`).addClass('active');
}

function initConsoleNavigation() {
  // Sync when top tabs are clicked
  $(document).on('click', '.tabs .tab', function () {
    const tabId = $(this).attr('id');
    if (tabId) {
      switchToTab(tabId);
    }
  });

  // Sync when bottom navbar items are clicked
  $(document).on('click', '.navbar [data-tab]', function (e) {
    const tabId = $(this).attr('data-tab');
    if (tabId) {
      switchToTab(tabId);
    }
  });

  // Bootstrap native tab shown event listener
  $(document).on('shown.bs.tab', function (e) {
    const tabId = $(e.target).attr('id');
    if (tabId) {
      syncTabUI(tabId);
    }
  });

  // Set initial sync state
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('#syncStateText').text('Synced ' + timeNow);
}

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
// --- QR Code Logic ---
const debouncedGenerateQr = debounce(generateQrCode, 200);

$("#qrInput, #qrColorDark, #qrColorLight, #qrCorrection, #qrMargin").on("input change", debouncedGenerateQr);

function generateQrCode() {
  const text = $("#qrInput").val().trim();
  const canvas = document.getElementById("qrCanvas");
  
  if (text) {
    $("#qrPrintArea").show();
    $("#exportQrBtn").removeClass("disabled");
    
    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(canvas, text, {
        width: 300,
        margin: parseInt($("#qrMargin").val()) || 2,
        color: {
          dark: $("#qrColorDark").val(),
          light: $("#qrColorLight").val()
        },
        errorCorrectionLevel: $("#qrCorrection").val()
      }, function (error) {
        if (error) console.error(error);
      });
    } else {
      showToast("QR Code library not loaded", "err");
    }
  } else {
    $("#qrPrintArea").hide();
    $("#exportQrBtn").addClass("disabled");
  }
}

function exportQrCode() {
  const text = $("#qrInput").val().trim();
  if (!text) return;
  
  const canvas = document.getElementById("qrCanvas");
  const dataUrl = canvas.toDataURL("image/png");
  
  const a = document.createElement("a");
  a.href = dataUrl;
  // Generate a clean filename from the input text or a timestamp
  let cleanName = text.replace(/[^a-z0-9]/gi, '_').substring(0, 20);
  if (!cleanName) cleanName = 'qr_code';
  a.download = cleanName + ".png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast("QR Code exported", "ok");
}

/* ==========================================================================
   Preload Scan Module
   ========================================================================== */

const PRELOAD_STORAGE_KEY = 'barcode_preload_session_v1';
let preloadSession = {
  filename: '',
  timestamp: 0,
  packages: [],
  active: false
};

let preloadSoundEnabled = true;
let preloadVibrateEnabled = true;
let preloadStatusFilter = 'all';

let preloadStream = null;
let preloadDetector = null;
let preloadScanning = false;
let preloadPaused = false;
let preloadLastCode = null;
let preloadLastCodeTime = 0;
const PRELOAD_REPEAT_WINDOW = 1800; // ms to avoid duplicate spam from camera

let preloadAudioCtx = null;
function getPreloadAudioContext() {
  if (!preloadAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) preloadAudioCtx = new AudioContext();
  }
  if (preloadAudioCtx && preloadAudioCtx.state === 'suspended') {
    preloadAudioCtx.resume();
  }
  return preloadAudioCtx;
}

function playPreloadAudio(type) {
  if (!preloadSoundEnabled) return;
  try {
    const ctx = getPreloadAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'duplicate') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.08);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    console.warn("Preload audio error", e);
  }
}

function triggerPreloadHaptic() {
  if (preloadVibrateEnabled && navigator.vibrate) {
    try { navigator.vibrate([70]); } catch (e) {}
  }
}

function togglePreloadSound() {
  preloadSoundEnabled = !preloadSoundEnabled;
  const icon = document.getElementById('preloadSoundIcon');
  if (icon) {
    if (preloadSoundEnabled) {
      icon.className = 'bi bi-volume-up-fill fs-5 text-primary';
      showToast('Scan sound enabled', 'ok');
    } else {
      icon.className = 'bi bi-volume-mute-fill fs-5 text-muted';
      showToast('Scan sound muted', '');
    }
  }
}

function togglePreloadVibrate() {
  preloadVibrateEnabled = !preloadVibrateEnabled;
  const icon = document.getElementById('preloadVibrateIcon');
  if (icon) {
    if (preloadVibrateEnabled) {
      icon.className = 'bi bi-phone-vibrate fs-5 text-primary';
      showToast('Haptic vibration enabled', 'ok');
    } else {
      icon.className = 'bi bi-phone-fill fs-5 text-muted';
      showToast('Haptic vibration disabled', '');
    }
  }
}

function savePreloadSession() {
  try {
    if (preloadSession && preloadSession.active && preloadSession.packages.length) {
      localStorage.setItem(PRELOAD_STORAGE_KEY, JSON.stringify(preloadSession));
    } else {
      localStorage.removeItem(PRELOAD_STORAGE_KEY);
    }
  } catch (e) {
    console.warn("Failed to persist preload session", e);
  }
}

function initPreloadScan() {
  initPreloadDropZone();

  // Handle hardware scanner / manual input submission
  $('#preloadScanInput').on('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPreloadManualScan();
    }
  });

  // Check existing session in localStorage
  try {
    const saved = localStorage.getItem(PRELOAD_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.packages && parsed.packages.length) {
        preloadSession = parsed;
        const scannedCount = preloadSession.packages.filter(p => p.status === 'prescanned').length;
        $('#preloadResumeDetails').text(
          `${scannedCount} of ${preloadSession.packages.length} scanned (${preloadSession.filename || 'Manifest'})`
        );
        $('#preloadResumeBanner').removeClass('d-none').addClass('d-flex');
      } else {
        $('#preloadResumeBanner').addClass('d-none').removeClass('d-flex');
      }
    } else {
      $('#preloadResumeBanner').addClass('d-none').removeClass('d-flex');
    }
  } catch (e) {
    console.warn("Error checking saved preload session", e);
  }
}

function initPreloadDropZone() {
  const dropZone = document.getElementById('preloadDropZone');
  const fileInput = document.getElementById('preloadFileInput');
  if (!fileInput) return;

  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        handlePreloadFileInput(dt.files[0]);
      }
    }, false);
  }

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files && fileInput.files.length) {
      handlePreloadFileInput(fileInput.files[0]);
      fileInput.value = '';
    }
  });
}

async function handlePreloadFileInput(file) {
  if (!file) return;
  const name = file.name || 'manifest.csv';
  showToast('Reading ' + name + '...', '');

  if (name.toLowerCase().endsWith('.zip')) {
    if (typeof JSZip === 'undefined') {
      showToast('ZIP library failed to load. Check internet connection.', 'err');
      return;
    }
    try {
      const zip = await JSZip.loadAsync(file);
      let csvFile = null;
      zip.forEach((relPath, zipEntry) => {
        if (!csvFile && !zipEntry.dir && (relPath.toLowerCase().endsWith('.csv') || relPath.toLowerCase().endsWith('.txt'))) {
          csvFile = zipEntry;
        }
      });
      if (!csvFile) {
        showToast('No CSV found inside ZIP archive', 'err');
        return;
      }
      const text = await csvFile.async('string');
      processPreloadCsvContent(text, csvFile.name || name);
    } catch (err) {
      console.error(err);
      showToast('Error reading ZIP file: ' + err.message, 'err');
    }
  } else {
    const reader = new FileReader();
    reader.onload = function(evt) {
      processPreloadCsvContent(evt.target.result, name);
    };
    reader.onerror = function() {
      showToast('Failed to read manifest file', 'err');
    };
    reader.readAsText(file);
  }
}

function parsePastedManifest() {
  const text = $('#preloadPasteText').val().trim();
  if (!text) {
    showToast('Please paste CSV text first', 'warn');
    return;
  }
  processPreloadCsvContent(text, 'Pasted-Manifest-' + new Date().toLocaleTimeString());
}

function processPreloadCsvContent(csvText, filename) {
  if (typeof Papa === 'undefined') {
    showToast('CSV parser not available', 'err');
    return;
  }

  const parsed = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: 'greedy'
  });

  let rows = parsed.data;
  if (!rows || !rows.length) {
    showToast('No rows found in manifest', 'err');
    return;
  }

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);

  function findKey(patterns) {
    return keys.find(k => {
      const clean = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return patterns.some(p => clean === p || clean.includes(p));
    });
  }

  const barcodeKey = findKey(['barcode', 'tracking', 'trackingnumber', 'pkgid', 'code']);
  const seqKey = findKey(['seqno', 'seq', 'sequenceno', 'sequence', 'stopno', 'stop']);
  const addressKey = findKey(['address', 'deliveryaddress', 'destaddress', 'destination']);

  const packages = [];
  rows.forEach((row, idx) => {
    let barcode = (barcodeKey && row[barcodeKey] ? row[barcodeKey] : '').trim();
    let seq = (seqKey && row[seqKey] ? row[seqKey] : '').trim();
    let address = (addressKey && row[addressKey] ? row[addressKey] : '').trim();

    // Fallback if header matching missed
    if (!barcode && Object.values(row).length) {
      const vals = Object.values(row);
      barcode = (vals[0] || '').trim();
      seq = (vals[4] || '').trim();
      address = (vals[5] || '').trim();
    }

    if (barcode) {
      packages.push({
        id: 'pkg_' + (idx + 1),
        barcode: barcode.toUpperCase(),
        seq: seq || String(idx + 1),
        address: address || 'No address specified',
        status: 'pending',
        scannedAt: null,
        origIndex: idx
      });
    }
  });

  if (!packages.length) {
    showToast('No valid barcodes found in manifest data', 'err');
    return;
  }

  preloadSession = {
    filename: filename,
    timestamp: Date.now(),
    packages: packages,
    active: true
  };

  savePreloadSession();
  renderPreloadSessionUI();
  showToast(`Loaded ${packages.length} packages from ${filename}`, 'ok');

  // Auto focus barcode scan input
  setTimeout(() => {
    $('#preloadScanInput').focus();
  }, 200);
}

function resumePreloadSession() {
  if (!preloadSession || !preloadSession.packages || !preloadSession.packages.length) {
    showToast('No active session to resume', 'err');
    return;
  }
  renderPreloadSessionUI();
  showToast('Resumed active preload session', 'ok');
  setTimeout(() => {
    $('#preloadScanInput').focus();
  }, 200);
}

function confirmResetPreload(fromBanner) {
  if (!fromBanner && preloadSession && preloadSession.active) {
    const scannedCount = preloadSession.packages.filter(p => p.status === 'prescanned').length;
    if (!confirm(`Are you sure you want to clear this manifest? ${scannedCount} package(s) have been scanned.`)) {
      return;
    }
  }

  stopPreloadCamera();
  preloadSession = { filename: '', timestamp: 0, packages: [], active: false };
  localStorage.removeItem(PRELOAD_STORAGE_KEY);

  $('#preloadResumeBanner').addClass('d-none').removeClass('d-flex');
  $('#preloadActiveSection').hide();
  $('#preloadUploadSection').show();
  $('#preloadFileInput').val('');
  $('#preloadPasteText').val('');
  $('#preloadTableBody').empty();
  $('#preloadLastSeq').text('#---');
  $('#preloadLastAddress').text('Scan a package barcode to begin numbering');
  $('#preloadLastBarcode').text('Ready for scanner');
  showToast('Preload session reset', '');
}

function renderPreloadSessionUI() {
  if (!preloadSession || !preloadSession.active) return;

  $('#preloadUploadSection').hide();
  $('#preloadActiveSection').show();
  $('#preloadSessionFilename').text(preloadSession.filename || 'Manifest');
  if (preloadSession.timestamp) {
    $('#preloadSessionTime').text('Loaded ' + new Date(preloadSession.timestamp).toLocaleTimeString());
  }

  updatePreloadMetrics();
  renderPreloadTable();
}

function updatePreloadMetrics() {
  if (!preloadSession || !preloadSession.packages) return;
  const total = preloadSession.packages.length;
  const scanned = preloadSession.packages.filter(p => p.status === 'prescanned').length;
  const pending = total - scanned;
  const percent = total > 0 ? Math.round((scanned / total) * 100) : 0;

  $('#preloadTotalCount').text(total);
  $('#preloadScannedCount').text(scanned);
  $('#preloadPendingCount').text(pending);
  $('#preloadProgressPercent').text(percent + '%');

  $('#filterCountAll').text(total);
  $('#filterCountPending').text(pending);
  $('#filterCountScanned').text(scanned);

  $('#preloadProgressBar')
    .css('width', percent + '%')
    .attr('aria-valuenow', percent);

  $('#preloadProgressFill').css('width', percent + '%');
  $('#preloadProgressFraction').text(`${scanned} / ${total}`);

  // Update sync indicator
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('#syncStateText').text('Synced ' + timeNow);

  // If last scanned item exists, keep display updated
  const lastScannedPkg = [...preloadSession.packages]
    .filter(p => p.status === 'prescanned' && p.scannedAt)
    .sort((a, b) => b.scannedAt - a.scannedAt)[0];

  if (lastScannedPkg && $('#preloadLastSeq').text() === '#---') {
    $('#preloadLastSeq').text('#' + lastScannedPkg.seq);
    $('#preloadLastAddress').text(lastScannedPkg.address);
    $('#preloadLastBarcode').text(lastScannedPkg.barcode + ' · ' + new Date(lastScannedPkg.scannedAt).toLocaleTimeString());
  }

  renderPreloadLiveFeed();
}

function renderPreloadLiveFeed() {
  const container = $('#preloadLiveScanFeed');
  if (!container.length) return;

  if (!preloadSession || !preloadSession.packages) {
    container.html('<p class="text-muted small text-center py-2 mb-0">No scans recorded in this session yet</p>');
    return;
  }

  const recentScans = [...preloadSession.packages]
    .filter(p => p.status === 'prescanned' && p.scannedAt)
    .sort((a, b) => b.scannedAt - a.scannedAt)
    .slice(0, 5);

  if (recentScans.length === 0) {
    container.html('<p class="text-muted small text-center py-2 mb-0">No scans recorded in this session yet</p>');
    $('#preloadLiveScanCount').text('Recent scans');
    return;
  }

  $('#preloadLiveScanCount').text(`Last ${recentScans.length}`);

  let html = '';
  recentScans.forEach(pkg => {
    const timeStr = new Date(pkg.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    html += `
      <div class="scan-row">
        <div class="scan-icon ok">
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div class="scan-body">
          <div class="scan-code mono">${escapeHtml(pkg.barcode)} · #${escapeHtml(String(pkg.seq))}</div>
          <div class="scan-meta">${escapeHtml(pkg.address)}</div>
        </div>
        <div class="scan-time mono">${timeStr}</div>
      </div>
    `;
  });

  container.html(html);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setPreloadStatusFilter(status) {
  preloadStatusFilter = status;
  $('#preloadFilterStatusGroup button').removeClass('active');
  $(`#preloadFilterStatusGroup button[data-status="${status}"]`).addClass('active');
  renderPreloadTable();
}

function renderPreloadTable() {
  if (!preloadSession || !preloadSession.packages) return;

  const searchTerm = ($('#preloadFilterSearch').val() || '').trim().toLowerCase();
  const tbody = $('#preloadTableBody');
  tbody.empty();

  let filtered = preloadSession.packages.filter(pkg => {
    // Status filter
    if (preloadStatusFilter === 'pending' && pkg.status !== 'pending') return false;
    if (preloadStatusFilter === 'prescanned' && pkg.status !== 'prescanned') return false;

    // Search filter
    if (searchTerm) {
      const matchSeq = String(pkg.seq).toLowerCase().includes(searchTerm);
      const matchBarcode = pkg.barcode.toLowerCase().includes(searchTerm);
      const matchAddr = pkg.address.toLowerCase().includes(searchTerm);
      if (!matchSeq && !matchBarcode && !matchAddr) return false;
    }
    return true;
  });

  $('#preloadShowingCount').text(`Showing ${filtered.length} of ${preloadSession.packages.length} packages`);

  if (!filtered.length) {
    tbody.html('<tr><td colspan="5" class="text-center py-4 text-muted">No packages match the current filter</td></tr>');
    return;
  }

  const rowsHtml = [];
  filtered.forEach(pkg => {
    const isScanned = pkg.status === 'prescanned';
    const rowClass = isScanned ? 'preload-row-scanned' : '';
    const badge = isScanned
      ? `<span class="badge-prescanned"><i class="bi bi-check-circle me-1"></i>Pre-scanned</span>`
      : `<span class="badge-pending">Pending</span>`;
    const actionBtn = isScanned
      ? `<button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size:.78rem;" onclick="togglePreloadManualPackageStatus('${pkg.id}')">Undo</button>`
      : `<button class="btn btn-sm btn-outline-success py-0 px-2" style="font-size:.78rem;" onclick="togglePreloadManualPackageStatus('${pkg.id}')">Mark</button>`;

    rowsHtml.push(`
      <tr class="${rowClass}" id="preload-row-${pkg.id}">
        <td><strong class="font-monospace text-primary fs-6">#${pkg.seq}</strong></td>
        <td><span class="font-monospace small fw-bold">${pkg.barcode}</span></td>
        <td class="small fw-semibold text-dark">${pkg.address}</td>
        <td class="text-center">${badge}</td>
        <td class="text-end">${actionBtn}</td>
      </tr>
    `);
  });

  tbody.html(rowsHtml.join(''));
}

function submitPreloadManualScan() {
  const input = $('#preloadScanInput');
  const code = input.val().trim();
  if (!code) return;
  input.val('');
  handlePreloadBarcodeScan(code);
  input.focus();
}

function handlePreloadBarcodeScan(rawCode) {
  if (!preloadSession || !preloadSession.packages || !preloadSession.packages.length) {
    showToast('Please upload a manifest first', 'warn');
    return;
  }

  let code = (rawCode || '').trim();
  // Strip pipe delimiters from 2D/QR codes
  if (code.includes('|')) {
    code = code.split('|')[0];
  }

  // Complex 2D barcodes extraction
  if (code.length > 25 || code.includes('[)>')) {
    const extractMatch = code.match(/(1LS[A-Za-z0-9]{12}|D100[A-Za-z0-9]{11}|C12[A-Za-z0-9]{12}|SPX[A-Za-z0-9]+)/i);
    if (extractMatch) {
      code = extractMatch[0];
    }
  }

  code = code.toUpperCase();

  // Apply carrier filter rules
  const filter = $('#preloadCarrierFilter').val() || 'general';
  let isValidCarrier = false;
  const isOnTrac = (code.startsWith('1LS') || code.startsWith('D100') || code.startsWith('C12')) && code.length >= 10;
  const isSpeedX = code.startsWith('SPX') && code.length >= 9;
  const isGoPro = (code.startsWith('D') || code.startsWith('GF')) && code.length >= 9;

  if (filter === 'any') isValidCarrier = true;
  else if (filter === 'ontrac') isValidCarrier = isOnTrac;
  else if (filter === 'speedx') isValidCarrier = isSpeedX;
  else if (filter === 'gopro') isValidCarrier = isGoPro;
  else if (filter === 'general') isValidCarrier = code.length >= 8;

  if (!isValidCarrier) {
    showToast(`Code ignored by carrier filter (${filter}): ${code}`, 'warn');
    return;
  }

  // Flash camera box if active
  const scanBox = document.getElementById('preloadScanBox');
  if (scanBox) {
    scanBox.classList.remove('flash');
    void scanBox.offsetWidth;
    scanBox.classList.add('flash');
  }

  // Search package in manifest
  const pkg = preloadSession.packages.find(p => p.barcode === code);

  if (pkg) {
    const isAlreadyScanned = pkg.status === 'prescanned';

    // Update state
    pkg.status = 'prescanned';
    pkg.scannedAt = Date.now();

    // Update prominent display box
    $('#preloadLastSeq').text('#' + pkg.seq);
    $('#preloadLastAddress').text(pkg.address);
    $('#preloadLastBarcode').text(pkg.barcode + ' · ' + new Date(pkg.scannedAt).toLocaleTimeString());

    if (isAlreadyScanned) {
      playPreloadAudio('duplicate');
      triggerPreloadHaptic();
      showToast(`Already scanned: Seq #${pkg.seq} (${pkg.barcode})`, 'warn');
    } else {
      playPreloadAudio('success');
      triggerPreloadHaptic();
      showToast(`Scanned Seq #${pkg.seq} (${pkg.barcode})`, 'ok');
    }

    savePreloadSession();
    updatePreloadMetrics();
    renderPreloadTable();

    // Highlight row in table if visible
    const row = $(`#preload-row-${pkg.id}`);
    if (row.length) {
      row.addClass('table-success');
      setTimeout(() => row.removeClass('table-success'), 1200);
    }
  } else {
    // Barcode not in manifest
    playPreloadAudio('unknown');
    triggerPreloadHaptic();
    $('#preloadLastSeq').text('#???');
    $('#preloadLastAddress').text('NOT FOUND IN PRELOAD MANIFEST');
    $('#preloadLastBarcode').text(code + ' · Check package!');
    showToast(`Barcode ${code} not in manifest!`, 'err');
  }
}

function togglePreloadManualPackageStatus(pkgId) {
  if (!preloadSession || !preloadSession.packages) return;
  const pkg = preloadSession.packages.find(p => p.id === pkgId);
  if (!pkg) return;

  if (pkg.status === 'prescanned') {
    pkg.status = 'pending';
    pkg.scannedAt = null;
    showToast(`Marked #${pkg.seq} as Pending`, '');
  } else {
    pkg.status = 'prescanned';
    pkg.scannedAt = Date.now();
    $('#preloadLastSeq').text('#' + pkg.seq);
    $('#preloadLastAddress').text(pkg.address);
    $('#preloadLastBarcode').text(pkg.barcode + ' · ' + new Date(pkg.scannedAt).toLocaleTimeString());
    playPreloadAudio('success');
    showToast(`Marked #${pkg.seq} as Pre-scanned`, 'ok');
  }

  savePreloadSession();
  updatePreloadMetrics();
  renderPreloadTable();
}

/* -------------------------------------------------- Camera Scanner -------------------------------------------------- */

function togglePreloadCamera() {
  if (preloadScanning) {
    stopPreloadCamera();
  } else {
    startPreloadCamera();
  }
}

async function startPreloadCamera() {
  const section = $('#preloadCamSection');
  const btnText = $('#preloadCamBtnText');
  const status = $('#preloadCamStatus');
  const statusText = $('#preloadCamStatusText');
  const video = document.getElementById('preloadVideo');

  section.slideDown('fast');
  status.show();
  statusText.text('Requesting camera permission...');
  btnText.text('Stop Camera Scanner');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusText.text('Camera access not supported on this browser/device.');
    return;
  }

  try {
    preloadStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = preloadStream;
    await video.play();
  } catch (err) {
    statusText.text('Camera access failed: ' + (err.message || err.name));
    return;
  }

  if (!('BarcodeDetector' in window)) {
    statusText.text('Built-in BarcodeDetector not available in this browser. You can use a USB/Bluetooth wedge scanner or enter codes manually.');
    return;
  }

  const FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'upc_a', 'qr_code', 'pdf417', 'data_matrix'];
  try {
    preloadDetector = new BarcodeDetector({ formats: FORMATS });
  } catch (e) {
    preloadDetector = new BarcodeDetector();
  }

  status.hide();
  preloadScanning = true;
  preloadPaused = false;
  loopPreloadCamera();
}

function stopPreloadCamera() {
  preloadScanning = false;
  if (preloadStream) {
    preloadStream.getTracks().forEach(track => track.stop());
    preloadStream = null;
  }
  $('#preloadCamSection').slideUp('fast');
  $('#preloadCamBtnText').text('Start Camera Scanner');
}

async function loopPreloadCamera() {
  if (!preloadScanning) return;
  const video = document.getElementById('preloadVideo');

  if (!preloadPaused && preloadDetector && video && video.readyState >= 2) {
    try {
      const codes = await preloadDetector.detect(video);
      if (codes && codes.length) {
        for (const c of codes) {
          if (c.rawValue) {
            const now = Date.now();
            if (c.rawValue === preloadLastCode && (now - preloadLastCodeTime) < PRELOAD_REPEAT_WINDOW) {
              // Ignore repeated reading of same code while under lens
              continue;
            }
            preloadLastCode = c.rawValue;
            preloadLastCodeTime = now;
            handlePreloadBarcodeScan(c.rawValue);
          }
        }
      }
    } catch (e) {
      // transient detection errors can be ignored
    }
  }
  requestAnimationFrame(loopPreloadCamera);
}

/* -------------------------------------------------- Completion & Export -------------------------------------------------- */

function openPreloadCompleteModal() {
  if (!preloadSession || !preloadSession.packages || !preloadSession.packages.length) {
    showToast('No active session to complete', 'warn');
    return;
  }

  const scannedPkgs = preloadSession.packages.filter(p => p.status === 'prescanned');
  const pendingCount = preloadSession.packages.length - scannedPkgs.length;

  $('#modalScannedCount').text(scannedPkgs.length);
  $('#modalPendingCount').text(pendingCount);
  $('#modalTotalCount').text(preloadSession.packages.length);
  $('#preloadCompleteSummaryText').html(
    `Pre-scanned <strong>${scannedPkgs.length}</strong> of <strong>${preloadSession.packages.length}</strong> packages (${pendingCount} excluded).`
  );

  // Scanned barcodes list for textarea
  const lines = scannedPkgs.map(p => p.barcode);
  $('#preloadScannedListTextarea').val(lines.join('\n'));

  // Show Bootstrap modal
  const modalEl = document.getElementById('preloadCompleteModal');
  if (modalEl) {
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    } else {
      $('#preloadCompleteModal').modal('show');
    }
  }
}

function copyPreloadScannedBarcodes() {
  const text = $('#preloadScannedListTextarea').val();
  if (!text.trim()) {
    showToast('No scanned barcodes to copy', 'warn');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied scanned barcodes to clipboard', 'ok');
  }).catch(() => {
    $('#preloadScannedListTextarea').select();
    showToast('Copy failed — barcodes selected for manual copy', 'err');
  });
}

function downloadPreloadScannedTxt() {
  const text = $('#preloadScannedListTextarea').val();
  if (!text.trim()) {
    showToast('No scanned barcodes to download', 'warn');
    return;
  }

  const blob = new Blob([text + '\n'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `scanned-barcodes-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Downloaded text list', 'ok');
}

function sendPreloadToBulkTask() {
  if (!preloadSession || !preloadSession.packages) return;

  const scannedPkgs = preloadSession.packages.filter(p => p.status === 'prescanned');
  if (!scannedPkgs.length) {
    showToast('No pre-scanned barcodes to send', 'warn');
    return;
  }

  // Format as: "BARCODE, ADDRESS (Seq #X)"
  const entries = scannedPkgs.map(p => `${p.barcode}, ${p.address} (Seq #${p.seq})`);
  $('#barcodesBatchText').val(entries.join('\n'));

  // Close modal
  const modalEl = document.getElementById('preloadCompleteModal');
  if (modalEl) {
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    } else {
      $('#preloadCompleteModal').modal('hide');
    }
  }

  // Switch to Bulk Task tab
  const bulkTabBtn = document.getElementById('bulk-task-tab');
  if (bulkTabBtn) {
    if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
      bootstrap.Tab.getOrCreateInstance(bulkTabBtn).show();
    } else {
      $(bulkTabBtn).tab('show');
    }
  }

  // Automatically process batch so barcodes render immediately
  setTimeout(() => {
    processBatch();
    showToast(`Loaded ${scannedPkgs.length} scanned package(s) into Bulk Task for final load scan`, 'ok');
  }, 300);
}

function exportPreloadPdf() {
  if (!preloadSession || !preloadSession.packages) return;

  const scannedPkgs = preloadSession.packages.filter(p => p.status === 'prescanned');
  if (!scannedPkgs.length) {
    showToast('No pre-scanned barcodes to export', 'warn');
    return;
  }

  if (typeof window.jspdf === 'undefined' || typeof JsBarcode === 'undefined') {
    showToast('PDF rendering library not loaded', 'err');
    return;
  }

  const btn = $('#preloadExportPdfBtn');
  btn.prop('disabled', true).text('Building PDF...');

  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'letter' }); // Letter size: 612 x 792 pt
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 36;
      const usableW = pageW - margin * 2;
      const rowH = 92; // height per scannable barcode row (one per line)
      let y = margin + 30;
      let pageNum = 1;

      function renderHeader() {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(30, 40, 70);
        doc.text(`Preload Scanned Barcodes (${scannedPkgs.length} items)`, margin, margin + 14);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(110, 115, 130);
        const stamp = new Date().toLocaleString();
        doc.text(`Manifest: ${preloadSession.filename || 'Manifest'} · Generated ${stamp} · Page ${pageNum}`, margin, margin + 26);
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(1);
        doc.line(margin, margin + 32, pageW - margin, margin + 32);
      }

      renderHeader();

      scannedPkgs.forEach((pkg, index) => {
        if (y + rowH > pageH - margin) {
          doc.addPage();
          pageNum++;
          y = margin + 30;
          renderHeader();
        }

        // Row background container
        doc.setFillColor(248, 249, 252);
        doc.roundedRect(margin, y, usableW, rowH - 10, 6, 6, 'F');
        doc.setDrawColor(225, 230, 240);
        doc.roundedRect(margin, y, usableW, rowH - 10, 6, 6, 'D');

        // Sequence number callout
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(47, 95, 219);
        doc.text(`SEQ #${pkg.seq}`, margin + 12, y + 22);

        // Address
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 35, 50);
        const maxAddrW = usableW - 270;
        const splitAddress = doc.splitTextToSize(pkg.address, maxAddrW);
        doc.text(splitAddress, margin + 12, y + 40);

        // Render scannable barcode image using JsBarcode
        const canvas = document.createElement('canvas');
        try {
          JsBarcode(canvas, pkg.barcode, {
            format: 'CODE128',
            displayValue: true,
            fontSize: 12,
            height: 44,
            margin: 6,
            textMargin: 2
          });

          const barcodeTargetH = 58;
          const barcodeTargetW = canvas.width * (barcodeTargetH / canvas.height);
          const drawW = Math.min(barcodeTargetW, 230);
          const drawH = canvas.height * (drawW / canvas.width);
          const barcodeX = pageW - margin - drawW - 14;
          const barcodeY = y + (rowH - 10 - drawH) / 2;

          doc.addImage(canvas.toDataURL('image/png'), 'PNG', barcodeX, barcodeY, drawW, drawH);
        } catch (e) {
          doc.setFontSize(10);
          doc.setTextColor(200, 40, 40);
          doc.text(`[Barcode Render Error: ${pkg.barcode}]`, pageW - margin - 220, y + 36);
        }

        y += rowH;
      });

      const fileStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      doc.save(`preload-scanned-${fileStamp}.pdf`);
      showToast(`PDF saved: ${scannedPkgs.length} scannable barcode(s)`, 'ok');
    } catch (err) {
      console.error(err);
      showToast('PDF generation failed: ' + err.message, 'err');
    } finally {
      btn.prop('disabled', false).html('<i class="bi bi-file-earmark-pdf-fill me-1"></i>Download Scannable Barcodes (PDF)');
    }
  }, 40);
}

