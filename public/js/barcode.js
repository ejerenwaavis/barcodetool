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

function switchGenerateMode(mode) {
  if (mode === 'qr') {
    $('#genSubtabBarcode').removeClass('active');
    $('#genSubtabQr').addClass('active');
    $('#generateBarcodeMode').hide();
    $('#generateQrMode').show();

    // Smart-sync: Pre-fill QR input from barcode input if empty
    const barcodeVal = ($('#barcodeNumber').val() || '').trim();
    const qrVal = ($('#qrInput').val() || '').trim();
    if (barcodeVal && !qrVal) {
      $('#qrInput').val(barcodeVal);
      generateQrCode();
    }
    setTimeout(() => $('#qrInput').focus(), 100);
  } else {
    $('#genSubtabQr').removeClass('active');
    $('#genSubtabBarcode').addClass('active');
    $('#generateQrMode').hide();
    $('#generateBarcodeMode').show();

    // Smart-sync: Pre-fill barcode input from QR input if empty
    const barcodeVal = ($('#barcodeNumber').val() || '').trim();
    const qrVal = ($('#qrInput').val() || '').trim();
    if (qrVal && !barcodeVal) {
      $('#barcodeNumber').val(qrVal);
      render();
    }
    setTimeout(() => $('#barcodeNumber').focus(), 100);
  }
}

function switchToGenerateMode(mode) {
  switchToTab('generate');
  switchGenerateMode(mode);
}

function switchToTab(tabId) {
  if (!tabId) return;
  const cleanId = tabId.replace('-tab', '');

  if (cleanId === 'qrcode') {
    switchToGenerateMode('qr');
    return;
  }

  // 1. Switch visible tab pane in #nav-tabContent
  $('#nav-tabContent .tab-pane').removeClass('show active');
  const targetPane = $('#' + cleanId);
  if (targetPane.length) {
    targetPane.addClass('show active');
  }

  // 2. Update active states on bottom navbar
  $('.navbar .navitem, .navbar .navitem-center').removeClass('active');
  const matchingNav = $(`.navbar [data-tab="${cleanId}-tab"], .navbar [data-tab="${cleanId}"]`);
  if (matchingNav.length) {
    matchingNav.addClass('active');
  } else {
    // If it's a secondary tool in the modal (brand-finder, delimeter), highlight 'More'
    $(`.navbar [data-tab="more-tab"]`).addClass('active');
  }

  // 3. Scroll main view to top
  const mainEl = document.querySelector('.main');
  if (mainEl) {
    mainEl.scrollTop = 0;
  }
}

function initConsoleNavigation() {
  // Handle bottom navbar clicks
  $(document).on('click', '.navbar [data-tab]', function () {
    const tabId = $(this).attr('data-tab');
    if (tabId && tabId !== 'more-tab' && tabId !== 'more') {
      switchToTab(tabId);
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
  $("#barcodeName").val("");
  updateExportModal();
}

function updateExportModal() {
  const text = $("#barcodeNumber").val().toUpperCase().trim();
  const filename = $("#barcodeName").val().trim();
  
  if (text) {
    JsBarcode("#barcodeDuplicate", text, {
      font: "Arial",
      width: (text.length > 18) ? 1.4 : 1.7,
      marginTop: 40,
      height: 100,
      displayValue: true
    });
    
    const canvas = document.getElementById("barcodeDuplicate");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    if (filename) {
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "black";
      ctx.fillText(filename.toUpperCase(), canvas.width / 2, 24);
    }
    
    const dt = canvas.toDataURL('image/png');
    $("#downloadButton").attr("href", dt);
    $("#downloadButton").attr("download", (filename || text) + ".png");
  }
}

// Bind to filename input changes
$(document).ready(function() {
  $("#barcodeName").on("input", updateExportModal);
});

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
let preloadVoiceEnabled = false;
let preloadStatusFilter = 'all';
let preloadScanMode = 'verify'; // 'verify' | 'assign'
let preloadZipFilter = 'all';
let preloadDriverFilter = 'all';

const DRIVER_COLORS = [
  '#FF5A1F', // Orange (Default)
  '#2563EB', // Blue
  '#059669', // Emerald
  '#7C3AED', // Purple
  '#D97706', // Amber
  '#DC2626', // Red
  '#0D9488', // Teal
  '#4F46E5', // Indigo
  '#DB2777', // Pink
  '#475569'  // Slate
];

let preloadStream = null;
let preloadDetector = null;
let preloadZxingReader = null;
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

function togglePreloadVoice() {
  preloadVoiceEnabled = !preloadVoiceEnabled;
  $('#preloadVoiceIcon').css('color', preloadVoiceEnabled ? 'var(--accent)' : 'var(--muted)');
  if (preloadVoiceEnabled) {
    speakText("Voice announcements on");
    showToast("Voice announcements enabled", "ok");
  } else {
    showToast("Voice announcements disabled", "");
  }
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.05;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn("Speech synthesis error", e);
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
      preloadSession.scanMode = preloadScanMode;
      preloadSession.zipFilter = preloadZipFilter;
      preloadSession.driverFilter = preloadDriverFilter;
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
        if (parsed.scanMode) preloadScanMode = parsed.scanMode;
        if (parsed.zipFilter) preloadZipFilter = parsed.zipFilter;
        if (parsed.driverFilter) preloadDriverFilter = parsed.driverFilter;
        if (!parsed.routes || !parsed.routes.length) {
          parsed.routes = [{
            id: 'route_1',
            driverName: 'Driver 1',
            routeLabel: 'Route 1',
            fullLabel: 'Driver 1 — Route 1',
            shortCode: 'D-R1',
            color: DRIVER_COLORS[0],
            filename: parsed.filename || 'manifest.csv',
            courier: parsed.courier || 'General'
          }];
          parsed.packages.forEach(p => {
            if (!p.routeId) p.routeId = 'route_1';
            if (!p.driverName) p.driverName = 'Driver 1';
            if (!p.routeLabel) p.routeLabel = 'Route 1';
            if (!p.fullLabel) p.fullLabel = 'Driver 1 — Route 1';
            if (!p.routeShortCode) p.routeShortCode = 'D-R1';
            if (!p.routeColor) p.routeColor = DRIVER_COLORS[0];
          });
        }
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
  const lowerName = name.toLowerCase();
  showToast('Reading ' + name + '...', '');

  if (lowerName.endsWith('.zip')) {
    if (typeof JSZip === 'undefined') {
      showToast('ZIP library failed to load. Check internet connection.', 'err');
      return;
    }
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestEntries = [];
      zip.forEach((relPath, entry) => {
        if (!entry.dir && !relPath.startsWith('__MACOSX/')) {
          const lowerRel = relPath.toLowerCase();
          if (lowerRel.endsWith('.csv') || lowerRel.endsWith('.tsv') || lowerRel.endsWith('.txt') ||
              lowerRel.endsWith('.xlsx') || lowerRel.endsWith('.xls')) {
            manifestEntries.push({ path: relPath, entry });
          }
        }
      });

      if (!manifestEntries.length) {
        showToast('No valid CSV, XLS, or XLSX manifests found inside ZIP archive', 'err');
        return;
      }

      showToast('Extracting ' + manifestEntries.length + ' file(s) from ZIP...', '');
      let combinedRows = [];
      let formatDetected = 'ZIP';

      for (const item of manifestEntries) {
        const itemLower = item.path.toLowerCase();
        if (itemLower.endsWith('.xlsx') || itemLower.endsWith('.xls')) {
          if (typeof XLSX === 'undefined') {
            showToast('XLSX engine not ready yet. Please wait a moment.', 'err');
            return;
          }
          const buffer = await item.entry.async('arraybuffer');
          const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
          const rows = extractRowsFromWorkbook(wb);
          if (rows && rows.length) {
            combinedRows = combinedRows.concat(rows);
            formatDetected = 'ZIP (XLSX)';
          }
        } else {
          if (typeof Papa === 'undefined') {
            showToast('CSV parser not available', 'err');
            return;
          }
          const text = await item.entry.async('string');
          const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: 'greedy' });
          if (parsed && parsed.data && parsed.data.length) {
            combinedRows = combinedRows.concat(parsed.data);
            formatDetected = 'ZIP (CSV)';
          }
        }
      }

      if (!combinedRows.length) {
        showToast('Extracted files contained no readable rows', 'err');
        return;
      }

      processRawManifestRows(combinedRows, name, formatDetected);
    } catch (err) {
      console.error(err);
      showToast('Error extracting ZIP archive: ' + err.message, 'err');
    }
  } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    if (typeof XLSX === 'undefined') {
      showToast('XLSX library is loading. Please try again in a few seconds.', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const rows = extractRowsFromWorkbook(wb);
        if (!rows || !rows.length) {
          showToast('No rows found in spreadsheet', 'err');
          return;
        }
        processRawManifestRows(rows, name, lowerName.endsWith('.xlsx') ? 'XLSX' : 'XLS');
      } catch (err) {
        console.error(err);
        showToast('Failed to parse spreadsheet: ' + err.message, 'err');
      }
    };
    reader.onerror = function() {
      showToast('Failed to read spreadsheet file', 'err');
    };
    reader.readAsArrayBuffer(file);
  } else {
    // CSV, TSV, TXT
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      if (typeof Papa === 'undefined') {
        showToast('CSV parser not available', 'err');
        return;
      }
      const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: 'greedy' });
      if (!parsed.data || !parsed.data.length) {
        showToast('No rows found in manifest', 'err');
        return;
      }
      processRawManifestRows(parsed.data, name, 'CSV');
    };
    reader.onerror = function() {
      showToast('Failed to read manifest file', 'err');
    };
    reader.readAsText(file);
  }
}

function extractRowsFromWorkbook(wb) {
  if (!wb || !wb.SheetNames || !wb.SheetNames.length) return [];
  let sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'result');
  if (!sheetName) sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'manifest');
  if (!sheetName) sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'data');
  if (!sheetName) sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'parcels');
  if (!sheetName) sheetName = wb.SheetNames[0];

  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function parsePastedManifest() {
  const text = $('#preloadPasteText').val().trim();
  if (!text) {
    showToast('Please paste CSV or tab-delimited text first', 'warn');
    return;
  }
  if (typeof Papa === 'undefined') {
    showToast('CSV parser not available', 'err');
    return;
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
  if (!parsed.data || !parsed.data.length) {
    showToast('No rows parsed from clipboard text', 'err');
    return;
  }
  processRawManifestRows(parsed.data, 'Pasted-Manifest-' + new Date().toLocaleTimeString(), 'Pasted');
}

function normalizeHeaderKey(str) {
  if (str === null || str === undefined) return '';
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function isExcludedSeqHeader(cleanKey) {
  if (!cleanKey) return false;
  const EXCLUDED = [
    'serial', 'serialno', 'serialnumber', 'sn', 'sno', 'srno', 'sr',
    'row', 'rownum', 'rowno', 'index', 'idx',
    'id', 'customeraccountid', 'accountid', 'transittime',
    'itemid', 'parcelid', 'orderid', 'uid', 'uuid', 'barcodeid'
  ];
  return EXCLUDED.some(ex => cleanKey === ex || cleanKey.startsWith(ex + '_') || cleanKey.endsWith('_' + ex));
}

// Multi-driver route generator with automatic route separator for same driver
function allocateDriverRoute(driverName, routeLabel, filename, courierName) {
  if (!preloadSession.routes) preloadSession.routes = [];

  const rawDriver = (driverName || '').trim() || ('Driver ' + (preloadSession.routes.length + 1));
  const cleanDriver = rawDriver.charAt(0).toUpperCase() + rawDriver.slice(1);
  const initial = cleanDriver.charAt(0).toUpperCase();

  // Find existing routes for this same driver (case-insensitive)
  const existingForDriver = preloadSession.routes.filter(r => r.driverName.toLowerCase() === cleanDriver.toLowerCase());
  const routeNum = existingForDriver.length + 1;

  let assignedRouteLabel = routeLabel && routeLabel.trim() ? routeLabel.trim() : ('Route ' + routeNum);
  let fullLabel = `${cleanDriver} — ${assignedRouteLabel}`;
  let shortCode = `${initial}-R${routeNum}`;

  // If this is the second route for the driver, ensure the first route is labeled "Route 1"
  if (existingForDriver.length === 1 && existingForDriver[0].routeLabel === 'Route 1') {
    existingForDriver[0].fullLabel = `${cleanDriver} — Route 1`;
    existingForDriver[0].shortCode = `${initial}-R1`;
  }

  const colorIndex = preloadSession.routes.length % DRIVER_COLORS.length;
  const color = DRIVER_COLORS[colorIndex];

  const routeObj = {
    id: 'route_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    driverName: cleanDriver,
    routeLabel: assignedRouteLabel,
    fullLabel: fullLabel,
    shortCode: shortCode,
    color: color,
    filename: filename || 'manifest.csv',
    courier: courierName || 'General',
    created: Date.now()
  };

  preloadSession.routes.push(routeObj);
  return routeObj;
}

function processRawManifestRows(rows, filename, fileFormat, customDriverName, customRouteLabel, appendMode = false) {
  if (!rows || !rows.length) {
    showToast('No valid rows found in manifest', 'err');
    return;
  }

  let sampleRow = rows.find(r => r && Object.keys(r).length > 0) || rows[0];
  const keys = Object.keys(sampleRow);

  function findKey(aliases, excludeSeq = false) {
    for (const a of aliases) {
      const found = keys.find(k => {
        const clean = normalizeHeaderKey(k);
        if (excludeSeq && isExcludedSeqHeader(clean)) return false;
        return clean === a;
      });
      if (found) return found;
    }
    for (const a of aliases) {
      const found = keys.find(k => {
        const clean = normalizeHeaderKey(k);
        if (excludeSeq && isExcludedSeqHeader(clean)) return false;
        if (a.length <= 3) {
          return clean === a || clean.startsWith(a) || clean.endsWith(a);
        }
        return clean.includes(a);
      });
      if (found) return found;
    }
    return null;
  }

  const seqKey = findKey([
    'seqno', 'sequenceno', 'seq', 'sequence', 'sequencenumber',
    'stopnumber', 'stopno', 'stop', 'callsequence', 'routesequence',
    'routingsort', 'seqnum', 'stopnum', 'deliverysequence', 'sortnumber'
  ], true);

  let barcodeKey = findKey([
    'barcode', 'trackingno', 'trackingnumber', 'tracking',
    'packageid', 'packageidentification', 'pkgid', 'tba',
    'lasershipbarcode', 'awb', 'label', 'trackingcode',
    'waybill', 'parcelno', 'parcelid'
  ]);

  if (!barcodeKey) {
    const testSamples = rows.slice(0, 15);
    const patternRegex = /^(?:SPX[A-Z0-9]+|1LS[A-Z0-9]+|L[A-Z]{2}d+|TBAd+|C12[A-Z0-9]+|D100[A-Z0-9]+|[A-Z0-9]{10,32})$/i;
    let bestKey = null;
    let bestScore = 0;

    keys.forEach(k => {
      let score = 0;
      testSamples.forEach(r => {
        const val = String(r[k] || '').trim();
        if (patternRegex.test(val)) score++;
      });
      if (score > bestScore && score >= Math.min(3, testSamples.length)) {
        bestScore = score;
        bestKey = k;
      }
    });

    if (bestKey) barcodeKey = bestKey;
  }

  const addressKey = findKey([
    'address', 'streetaddress', 'addressline1', 'address1',
    'deliveryaddress', 'destaddress', 'destination', 'street',
    'fulladdress', 'addr'
  ]);

  const unitKey = findKey([
    'unit', 'addressline2', 'address2', 'apt', 'suite', 'ste',
    'apartment', 'bldg', 'building', 'unitnumber'
  ]);

  const zipKey = findKey(['zipcode', 'zip', 'postalcode', 'postal', 'postcode', 'pincode']);
  const cityKey = findKey(['city', 'town', 'municipality']);
  const stateKey = findKey(['state', 'province', 'st']);

  const recipientKey = findKey([
    'recipientname', 'consignee', 'consigneename', 'customer',
    'customername', 'recipient', 'contactname', 'name'
  ]);

  const phoneKey = findKey([
    'recipientphone', 'consigneephone', 'phone', 'contact',
    'telephone', 'tel', 'cell', 'mobile', 'phoneno'
  ]);

  const routeKey = findKey(['route', 'routecode', 'batch', 'batchid', 'routeno', 'routename', 'driverroute']);
  const weightKey = findKey(['weight', 'pkgweight', 'packageweight', 'weightlbs', 'weightkg']);
  const driverColKey = findKey(['drivername', 'driver', 'courier', 'assignedto', 'driverid']);

  // Detect Courier Name
  let courierName = 'Generic';
  const sampleBarcodes = rows.slice(0, 30).map(r => String((barcodeKey && r[barcodeKey]) || Object.values(r)[0] || ''));
  const sampleFilename = (filename || '').toLowerCase();

  if (sampleBarcodes.some(b => b.toUpperCase().startsWith('SPX')) || sampleFilename.includes('speedx') || sampleFilename.includes('route_parcel')) {
    courierName = 'SpeedX';
  } else if (sampleBarcodes.some(b => b.toUpperCase().startsWith('1LS') || b.toUpperCase().startsWith('D100') || b.toUpperCase().startsWith('C12')) || sampleFilename.includes('lasership') || keys.some(k => k.toLowerCase().includes('lasership'))) {
    courierName = 'LaserShip';
  } else if (keys.some(k => normalizeHeaderKey(k) === 'stopnumber') && keys.some(k => normalizeHeaderKey(k) === 'packageid')) {
    courierName = 'Circuit / Spoke';
  } else if (keys.some(k => normalizeHeaderKey(k) === 'stopnumber') && keys.some(k => normalizeHeaderKey(k) === 'streetaddress')) {
    courierName = 'RoadWarrior';
  }

  // Determine initial driver name
  let targetDriverName = customDriverName;
  if (!targetDriverName && driverColKey && sampleRow[driverColKey]) {
    targetDriverName = String(sampleRow[driverColKey]).trim();
  }
  if (!targetDriverName) {
    if (!appendMode && (!preloadSession.routes || !preloadSession.routes.length)) {
      targetDriverName = 'Driver 1';
    } else {
      targetDriverName = 'Driver ' + ((preloadSession.routes ? preloadSession.routes.length : 0) + 1);
    }
  }

  if (!appendMode) {
    preloadSession = {
      filename: filename,
      timestamp: Date.now(),
      packages: [],
      routes: [],
      courier: courierName,
      active: true
    };
  }

  const routeObj = allocateDriverRoute(targetDriverName, customRouteLabel, filename, courierName);

  // Parse and build normalized packages
  const newPackages = [];
  const startIdOffset = preloadSession.packages ? preloadSession.packages.length : 0;

  rows.forEach((row, idx) => {
    let rawBarcode = (barcodeKey && row[barcodeKey] !== undefined ? String(row[barcodeKey]) : '').trim();
    let rawSeq = (seqKey && row[seqKey] !== undefined ? String(row[seqKey]) : '').trim();
    let primaryAddr = (addressKey && row[addressKey] !== undefined ? String(row[addressKey]) : '').trim();
    let unit = (unitKey && row[unitKey] !== undefined ? String(row[unitKey]) : '').trim();
    let zip = (zipKey && row[zipKey] !== undefined ? String(row[zipKey]) : '').trim();
    let city = (cityKey && row[cityKey] !== undefined ? String(row[cityKey]) : '').trim();
    let state = (stateKey && row[stateKey] !== undefined ? String(row[stateKey]) : '').trim();
    let recipient = (recipientKey && row[recipientKey] !== undefined ? String(row[recipientKey]) : '').trim();
    let phone = (phoneKey && row[phoneKey] !== undefined ? String(row[phoneKey]) : '').trim();
    let route = (routeKey && row[routeKey] !== undefined ? String(row[routeKey]) : '').trim();
    let weight = (weightKey && row[weightKey] !== undefined ? String(row[weightKey]) : '').trim();

    if (!rawBarcode && Object.values(row).length) {
      const vals = Object.values(row).map(v => String(v || '').trim()).filter(Boolean);
      const barcodeCandidate = vals.find(v => /^(?:SPX|1LS|L[A-Z]{2}|TBA|[A-Z0-9]{10,32})/i.test(v));
      if (barcodeCandidate) rawBarcode = barcodeCandidate;
    }

    if (rawBarcode) {
      let cleanBarcode = rawBarcode.replace(/["']/g, '').trim().toUpperCase();
      if (cleanBarcode.includes('|')) cleanBarcode = cleanBarcode.split('|')[0].trim();

      let displayAddress = primaryAddr;
      if (unit) {
        const uClean = unit.toUpperCase();
        if (!displayAddress.toUpperCase().includes(uClean)) {
          displayAddress = displayAddress ? `${displayAddress}, ${unit}` : unit;
        }
      }
      if (!displayAddress) {
        if (zip) {
          displayAddress = (city ? city + ', ' : '') + (state ? state + ' ' : '') + zip;
        } else {
          displayAddress = 'No address specified';
        }
      }

      newPackages.push({
        id: 'pkg_' + (startIdOffset + idx + 1),
        barcode: cleanBarcode,
        seq: rawSeq || '?',
        address: displayAddress,
        primaryAddr: primaryAddr,
        unit: unit,
        zip: zip,
        city: city,
        state: state,
        recipient: recipient,
        phone: phone,
        route: route,
        weight: weight,
        routeId: routeObj.id,
        driverName: routeObj.driverName,
        routeLabel: routeObj.routeLabel,
        fullLabel: routeObj.fullLabel,
        routeShortCode: routeObj.shortCode,
        routeColor: routeObj.color,
        status: 'pending',
        scannedAt: null,
        origIndex: startIdOffset + idx
      });
    }
  });

  if (!newPackages.length) {
    showToast('No valid barcodes found in manifest data', 'err');
    return;
  }

  // Infer missing sequences if not unsequenced batch
  const nonZeroSeqs = newPackages.filter(p => {
    const s = String(p.seq).trim();
    return s !== '' && s !== '?' && s !== '0' && s !== '0.0' && s !== '00';
  });
  const isUnsequenced = nonZeroSeqs.length === 0;

  if (!isUnsequenced) {
    for (const pkg of newPackages) {
      if (pkg.seq === '?') {
        const targetUpper = pkg.address.toUpperCase();
        const streetMatch = targetUpper.match(/^\s*\d+\s+([A-Z\s]+)/);
        let streetName = "";
        if (streetMatch && streetMatch[1]) {
          streetName = streetMatch[1].split(/(?:APT|UNIT|STE|#|SUITE|FL)\b/)[0].trim();
        } else {
          streetName = targetUpper.replace(/\d+/g, '').trim();
        }

        if (streetName.length >= 4) {
          for (const other of newPackages) {
            const otherSeq = String(other.seq);
            if (otherSeq !== '?' && !otherSeq.includes('.') && other.address.toUpperCase().includes(streetName)) {
              pkg.seq = otherSeq + '.5';
              break;
            }
          }
        }
      }
    }
  }

  preloadSession.packages = (preloadSession.packages || []).concat(newPackages);
  preloadSession.isUnsequenced = isUnsequenced;
  if (!preloadSession.nextAssignSeq) preloadSession.nextAssignSeq = 1;

  if (isUnsequenced) {
    preloadScanMode = 'assign';
  }

  savePreloadSession();
  renderPreloadSessionUI();

  if (appendMode) {
    showToast(`Added ${newPackages.length} packages to ${routeObj.fullLabel}!`, 'ok');
  } else {
    showToast(`Loaded ${newPackages.length} packages for ${routeObj.fullLabel}`, 'ok');
  }

  setTimeout(() => {
    $('#preloadScanInput').focus();
  }, 200);
}

// Add Driver Modal Handlers
function openAddDriverModal() {
  $('#addDriverNameInput').val('');
  $('#addDriverRouteInput').val('');
  $('#addDriverFileInput').val('');
  $('#addDriverPasteText').val('');
  const modalEl = document.getElementById('addDriverModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

async function submitAddDriverManifest() {
  const driverName = $('#addDriverNameInput').val().trim();
  if (!driverName) {
    showToast('Please enter a Driver Name', 'warn');
    return;
  }
  const routeLabel = $('#addDriverRouteInput').val().trim();
  const fileInput = document.getElementById('addDriverFileInput');
  const pasteText = $('#addDriverPasteText').val().trim();

  const modalEl = document.getElementById('addDriverModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }

  if (fileInput && fileInput.files && fileInput.files.length) {
    const file = fileInput.files[0];
    const name = file.name || 'manifest.csv';
    const lowerName = name.toLowerCase();
    showToast('Reading ' + name + ' for ' + driverName + '...', '');

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const rows = extractRowsFromWorkbook(wb);
          processRawManifestRows(rows, name, 'XLSX', driverName, routeLabel, true);
        } catch (err) {
          showToast('Failed to parse Excel: ' + err.message, 'err');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = function(evt) {
        const parsed = Papa.parse(evt.target.result.trim(), { header: true, skipEmptyLines: 'greedy' });
        processRawManifestRows(parsed.data, name, 'CSV', driverName, routeLabel, true);
      };
      reader.readAsText(file);
    }
  } else if (pasteText) {
    const parsed = Papa.parse(pasteText, { header: true, skipEmptyLines: 'greedy' });
    processRawManifestRows(parsed.data, 'Pasted-' + driverName, 'Pasted', driverName, routeLabel, true);
  } else {
    showToast('Please select a manifest file or paste text', 'warn');
  }
}

// Split Manifest by Drivers Modal Handlers
function openSplitManifestModal() {
  if (!preloadSession || !preloadSession.packages || !preloadSession.packages.length) {
    showToast('Upload a manifest before splitting across drivers', 'warn');
    return;
  }

  // Populate Zip Code split rows
  const zipContainer = $('#splitZipContainer');
  zipContainer.empty();

  const zipCounts = {};
  preloadSession.packages.forEach(p => {
    const z = (p.zip || 'Unknown').trim();
    zipCounts[z] = (zipCounts[z] || 0) + 1;
  });

  const sortedZips = Object.keys(zipCounts).sort();
  sortedZips.forEach((z, idx) => {
    zipContainer.append(`
      <div class="d-flex align-items-center gap-2 p-2 border rounded bg-light">
        <span class="badge bg-dark fw-bold font-monospace" style="min-width:70px; font-size:12px;">${escapeHtml(z)}</span>
        <span class="text-muted small" style="min-width:65px;">${zipCounts[z]} pkgs</span>
        <input type="text" class="form-control form-control-sm split-zip-driver-input" data-zip="${escapeHtml(z)}" placeholder="Assign Driver Name (e.g. Maria, John)" value="Driver ${idx + 1}">
      </div>
    `);
  });

  renderSplitCountInputs();

  const modalEl = document.getElementById('splitManifestModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function renderSplitCountInputs() {
  const count = parseInt($('#splitDriverCountSelect').val()) || 3;
  const container = $('#splitCountDriversContainer');
  container.empty();

  const total = preloadSession.packages ? preloadSession.packages.length : 0;
  const perDriver = Math.floor(total / count);

  for (let i = 1; i <= count; i++) {
    const approx = i === count ? total - (perDriver * (count - 1)) : perDriver;
    container.append(`
      <div class="d-flex align-items-center gap-2 p-2 border rounded bg-light">
        <span class="badge bg-primary" style="min-width:70px;">Driver ${i}</span>
        <span class="text-muted small" style="min-width:75px;">~${approx} pkgs</span>
        <input type="text" class="form-control form-control-sm split-count-driver-input" data-index="${i}" placeholder="Driver Name" value="Driver ${i}">
      </div>
    `);
  }
}

function submitSplitManifest() {
  if (!preloadSession || !preloadSession.packages) return;

  const isZipTabActive = $('#splitByZipTab').hasClass('active');
  const modalEl = document.getElementById('splitManifestModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }

  // Clear existing routes
  preloadSession.routes = [];

  if (isZipTabActive) {
    // Split by Zip Code
    const zipMap = {};
    $('.split-zip-driver-input').each(function() {
      const zip = $(this).data('zip');
      const driver = $(this).val().trim() || 'Driver';
      zipMap[zip] = driver;
    });

    const routeMap = {};
    preloadSession.packages.forEach(p => {
      const z = (p.zip || 'Unknown').trim();
      const driver = zipMap[z] || 'Driver 1';
      if (!routeMap[driver]) {
        routeMap[driver] = allocateDriverRoute(driver, null, preloadSession.filename, preloadSession.courier);
      }
      const r = routeMap[driver];
      p.routeId = r.id;
      p.driverName = r.driverName;
      p.routeLabel = r.routeLabel;
      p.fullLabel = r.fullLabel;
      p.routeShortCode = r.shortCode;
      p.routeColor = r.color;
    });
  } else {
    // Equal count split
    const driverNames = [];
    $('.split-count-driver-input').each(function() {
      driverNames.push($(this).val().trim() || ('Driver ' + ($(this).data('index') || 1)));
    });

    const numDrivers = driverNames.length;
    const total = preloadSession.packages.length;
    const chunkSize = Math.ceil(total / numDrivers);

    const routes = driverNames.map(name => allocateDriverRoute(name, null, preloadSession.filename, preloadSession.courier));

    preloadSession.packages.forEach((p, idx) => {
      const driverIdx = Math.min(Math.floor(idx / chunkSize), numDrivers - 1);
      const r = routes[driverIdx];
      p.routeId = r.id;
      p.driverName = r.driverName;
      p.routeLabel = r.routeLabel;
      p.fullLabel = r.fullLabel;
      p.routeShortCode = r.shortCode;
      p.routeColor = r.color;
    });
  }

  savePreloadSession();
  renderPreloadSessionUI();
  showToast(`Split ${preloadSession.packages.length} packages across ${preloadSession.routes.length} driver routes!`, 'ok');
}

function processPreloadCsvContent(csvText, filename) {
  if (typeof Papa === 'undefined') {
    showToast('CSV parser not available', 'err');
    return;
  }
  const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: 'greedy' });
  if (!parsed.data || !parsed.data.length) {
    showToast('No rows found in manifest', 'err');
    return;
  }
  processRawManifestRows(parsed.data, filename, 'CSV');
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
  preloadSession = { filename: '', timestamp: 0, packages: [], routes: [], active: false };
  localStorage.removeItem(PRELOAD_STORAGE_KEY);

  preloadScanMode = 'verify';
  preloadZipFilter = 'all';
  preloadDriverFilter = 'all';

  $('#preloadResumeBanner').addClass('d-none').removeClass('d-flex');
  $('#preloadActiveSection').hide();
  $('#preloadUploadSection').show();
  $('#preloadFileInput').val('');
  $('#preloadPasteText').val('');
  $('#preloadTableBody').empty();
  $('#preloadLastSeq').text('#---');
  $('#preloadLastDriverBadge').hide().empty();
  $('#preloadLastDriverRouteTag').hide().empty();
  $('#preloadLastAddress').text('Scan a package barcode to begin numbering');
  $('#preloadLastBarcode').text('Ready for scanner');
  showToast('Preload session reset', '');
}

function renderPreloadSessionUI() {
  if (!preloadSession || !preloadSession.active) return;

  $('#preloadUploadSection').hide();
  $('#preloadActiveSection').show();

  const total = preloadSession.packages ? preloadSession.packages.length : 0;
  const scanned = preloadSession.packages ? preloadSession.packages.filter(p => p.status === 'prescanned').length : 0;
  const pending = total - scanned;

  // 1. Update Flush Slim Status Strip
  const routeCount = preloadSession.routes ? preloadSession.routes.length : 1;
  const poolBadgeText = routeCount > 1 ? `Team Pool (${routeCount})` : (preloadSession.routes && preloadSession.routes[0] ? preloadSession.routes[0].fullLabel : 'Active Route');
  $('#preloadPoolBadge').text(poolBadgeText);
  $('#preloadSessionMiniInfo').html(`<strong class="text-dark">${total}</strong> total · <strong class="text-success">${scanned}</strong> scan`);

  // 2. Update Collapsible Detailed Summary
  $('#preloadSessionFilename').text(preloadSession.filename || 'Manifest');
  if (preloadSession.timestamp) {
    $('#preloadSessionTime').text('Loaded ' + new Date(preloadSession.timestamp).toLocaleTimeString());
  }

  // Render Team Drivers Summary Cards
  renderDriversSummaryStrip();

  // Update Courier Badge
  $('#preloadCourierBadge').text(preloadSession.courierBadge || `${preloadSession.courier || 'Universal'} (${total} pkgs)`);

  if (preloadSession.isUnsequenced) {
    $('#preloadUnsequencedBadge').removeClass('d-none');
    $('#preloadUnsequencedNotice').removeClass('d-none');
  } else {
    $('#preloadUnsequencedBadge').addClass('d-none');
    $('#preloadUnsequencedNotice').addClass('d-none');
  }

  // Populate Filter Dropdowns
  populatePreloadDriverDropdown();
  populatePreloadZipDropdown();

  // Populate Export Dropdown Menu
  renderPreloadExportDropdown();

  // Update Mode buttons
  setPreloadScanMode(preloadScanMode || 'verify', true);

  updatePreloadMetrics();
  renderPreloadTable();
}

function renderDriversSummaryStrip() {
  const container = $('#preloadDriversSummaryStrip');
  if (!container.length) return;
  container.empty();

  if (!preloadSession.routes || !preloadSession.routes.length) {
    container.html('<span class="text-muted small">Single Route Manifest</span>');
    return;
  }

  preloadSession.routes.forEach(r => {
    const driverPkgs = preloadSession.packages.filter(p => p.routeId === r.id);
    const dTotal = driverPkgs.length;
    const dScanned = driverPkgs.filter(p => p.status === 'prescanned').length;
    const pct = dTotal > 0 ? Math.round((dScanned / dTotal) * 100) : 0;

    container.append(`
      <div class="driver-mini-card">
        <span class="driver-route-badge" style="background:${r.color};">${escapeHtml(r.shortCode)}</span>
        <div>
          <div class="fw-bold text-dark text-truncate" style="max-width:110px;">${escapeHtml(r.driverName)}</div>
          <div class="text-muted" style="font-size:10px;">${dScanned}/${dTotal} (${pct}%)</div>
        </div>
      </div>
    `);
  });
}

function populatePreloadDriverDropdown() {
  const select = $('#preloadDriverFilter');
  if (!select.length) return;
  select.empty();

  const total = preloadSession.packages ? preloadSession.packages.length : 0;
  select.append(`<option value="all">All Drivers (${total})</option>`);

  if (!preloadSession.routes) return;
  preloadSession.routes.forEach(r => {
    const count = preloadSession.packages.filter(p => p.routeId === r.id).length;
    select.append(`<option value="${r.id}">${escapeHtml(r.fullLabel)} (${count})</option>`);
  });

  select.val(preloadDriverFilter || 'all');
}

function populatePreloadZipDropdown() {
  const select = $('#preloadZipFilter');
  if (!select.length) return;
  select.empty();

  const totalPkgs = preloadSession.packages ? preloadSession.packages.length : 0;
  select.append(`<option value="all">All Zips (${totalPkgs})</option>`);

  if (!preloadSession.packages) return;

  const zipCounts = {};
  preloadSession.packages.forEach(p => {
    const z = (p.zip || '').trim();
    if (z) {
      zipCounts[z] = (zipCounts[z] || 0) + 1;
    }
  });

  const sortedZips = Object.keys(zipCounts).sort();
  sortedZips.forEach(z => {
    select.append(`<option value="${escapeHtml(z)}">${escapeHtml(z)} (${zipCounts[z]} pkgs)</option>`);
  });

  select.val(preloadZipFilter || 'all');
}

function handlePreloadDriverFilterChange() {
  preloadDriverFilter = $('#preloadDriverFilter').val() || 'all';
  updatePreloadMetrics();
  renderPreloadTable();
}

function handlePreloadZipFilterChange() {
  preloadZipFilter = $('#preloadZipFilter').val() || 'all';
  updatePreloadMetrics();
  renderPreloadTable();
}

function setPreloadScanMode(mode, silent) {
  preloadScanMode = mode;
  $('#modeVerifyBtn').toggleClass('active', mode === 'verify');
  $('#modeAssignBtn').toggleClass('active', mode === 'assign');
  if (mode === 'assign') {
    const nextSeq = preloadSession && preloadSession.nextAssignSeq ? preloadSession.nextAssignSeq : 1;
    $('#preloadAssignCounterBadge').show().text(`Next: #${nextSeq}`);
    if (!silent) showToast('Scan & Assign mode: scanning packages will assign stop numbers 1, 2, 3...', 'ok');
  } else {
    $('#preloadAssignCounterBadge').hide();
    if (!silent) showToast('Verify mode: verifying packages against manifest stop numbers', '');
  }
}

function updatePreloadMetrics() {
  if (!preloadSession || !preloadSession.packages) return;

  let targetPkgs = preloadSession.packages;

  // Apply Driver filter
  if (preloadDriverFilter !== 'all') {
    targetPkgs = targetPkgs.filter(p => p.routeId === preloadDriverFilter);
  }

  // Apply Zip filter
  if (preloadZipFilter !== 'all') {
    targetPkgs = targetPkgs.filter(p => (p.zip || '').trim() === preloadZipFilter);
  }

  const total = targetPkgs.length;
  const scanned = targetPkgs.filter(p => p.status === 'prescanned').length;
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

  // Update Mini Info Strip
  const allTotal = preloadSession.packages.length;
  const allScanned = preloadSession.packages.filter(p => p.status === 'prescanned').length;
  const allPending = allTotal - allScanned;
  $('#preloadSessionMiniInfo').html(`<strong class="text-dark">${allTotal}</strong> total · <strong class="text-success">${allScanned}</strong> scan`);

  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('#syncStateText').text('Synced ' + timeNow);

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
    const badgeColor = pkg.routeColor || '#FF5A1F';
    html += `
      <div class="scan-row">
        <div class="scan-icon ok">
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div class="scan-body">
          <div class="scan-code mono">
            <span class="driver-route-badge" style="background:${badgeColor}; font-size:10px; padding:1px 5px;">${escapeHtml(pkg.routeShortCode || 'R1')}</span>
            ${escapeHtml(pkg.barcode)} · #${escapeHtml(String(pkg.seq))}
          </div>
          <div class="scan-meta">${escapeHtml(pkg.driverName ? pkg.driverName + ' • ' : '')}${escapeHtml(pkg.address)}</div>
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
    // Driver filter
    if (preloadDriverFilter !== 'all') {
      if (pkg.routeId !== preloadDriverFilter) return false;
    }

    // Zip filter
    if (preloadZipFilter !== 'all') {
      if ((pkg.zip || '').trim() !== preloadZipFilter) return false;
    }

    // Status filter
    if (preloadStatusFilter === 'pending' && pkg.status !== 'pending') return false;
    if (preloadStatusFilter === 'prescanned' && pkg.status !== 'prescanned') return false;

    // Search filter
    if (searchTerm) {
      const matchSeq = String(pkg.seq).toLowerCase().includes(searchTerm);
      const matchBarcode = pkg.barcode.toLowerCase().includes(searchTerm);
      const matchAddr = pkg.address.toLowerCase().includes(searchTerm);
      const matchDriver = (pkg.driverName || '').toLowerCase().includes(searchTerm);
      const matchZip = (pkg.zip || '').toLowerCase().includes(searchTerm);
      if (!matchSeq && !matchBarcode && !matchAddr && !matchDriver && !matchZip) return false;
    }
    return true;
  });

  $('#preloadShowingCount').text(`Showing ${filtered.length} of ${preloadSession.packages.length} packages`);

  if (!filtered.length) {
    tbody.html('<tr><td colspan="6" class="text-center py-4 text-muted">No packages match the current filter</td></tr>');
    return;
  }

  const rowsHtml = [];
  filtered.forEach(pkg => {
    const isScanned = pkg.status === 'prescanned';
    const rowClass = isScanned ? 'preload-row-scanned' : '';
    const badge = isScanned
      ? `<span class="badge-prescanned"><i class="bi bi-check-circle me-1"></i>Scanned</span>`
      : `<span class="badge-pending">Pending</span>`;
    const actionBtn = isScanned
      ? `<button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size:.78rem;" onclick="togglePreloadManualPackageStatus('${pkg.id}')">Undo</button>`
      : `<button class="btn btn-sm btn-outline-success py-0 px-2" style="font-size:.78rem;" onclick="togglePreloadManualPackageStatus('${pkg.id}')">Mark</button>`;

    const seqDisplay = (pkg.seq === '?' || pkg.seq === '0') ? `<span class="text-muted">#--</span>` : `#${pkg.seq}`;
    const zipBadge = pkg.zip ? `<span class="preload-zip-badge">${escapeHtml(pkg.zip)}</span>` : '';
    const driverBadge = `<span class="driver-route-badge" style="background:${pkg.routeColor || '#FF5A1F'}; font-size:10.5px;">${escapeHtml(pkg.routeShortCode || 'R1')}</span> <span class="small fw-semibold">${escapeHtml(pkg.driverName || 'Driver')}</span>`;

    rowsHtml.push(`
      <tr class="${rowClass}" id="preload-row-${pkg.id}">
        <td><strong class="font-monospace text-primary fs-6">${seqDisplay}</strong></td>
        <td>${driverBadge}</td>
        <td><span class="font-monospace small fw-bold">${escapeHtml(pkg.barcode)}</span></td>
        <td class="small fw-semibold text-dark">${escapeHtml(pkg.address)} ${zipBadge}</td>
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
  const originalRawCode = code;

  if (code.includes('|')) {
    code = code.split('|')[0];
  }

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

  const scanBox = document.getElementById('preloadScanBox');
  if (scanBox) {
    scanBox.classList.remove('flash');
    void scanBox.offsetWidth;
    scanBox.classList.add('flash');
  }

  let pkg = preloadSession.packages.find(p => p.barcode === code);

  // If in 'assign' mode and package not found: add it as an ad-hoc package
  if (!pkg && preloadScanMode === 'assign') {
    if (!preloadSession.nextAssignSeq) preloadSession.nextAssignSeq = 1;
    const assignedSeq = String(preloadSession.nextAssignSeq++);
    const defaultRoute = (preloadSession.routes && preloadSession.routes[0]) || {
      id: 'route_1',
      driverName: 'Driver 1',
      routeLabel: 'Route 1',
      fullLabel: 'Driver 1 — Route 1',
      shortCode: 'D-R1',
      color: DRIVER_COLORS[0]
    };

    pkg = {
      id: 'pkg_' + (preloadSession.packages.length + 1),
      barcode: code,
      seq: assignedSeq,
      address: 'Ad-hoc scanned package',
      primaryAddr: 'Ad-hoc scanned package',
      unit: '',
      zip: '',
      routeId: defaultRoute.id,
      driverName: defaultRoute.driverName,
      routeLabel: defaultRoute.routeLabel,
      fullLabel: defaultRoute.fullLabel,
      routeShortCode: defaultRoute.shortCode,
      routeColor: defaultRoute.color,
      status: 'pending',
      scannedAt: null,
      origIndex: preloadSession.packages.length
    };
    preloadSession.packages.push(pkg);
    $('#preloadAssignCounterBadge').text(`Next: #${preloadSession.nextAssignSeq}`);
  }

  if (pkg) {
    const isAlreadyScanned = pkg.status === 'prescanned';

    // In 'assign' mode, assign next sequential number if not already assigned
    if (preloadScanMode === 'assign' && (!pkg.seq || pkg.seq === '0' || pkg.seq === '?')) {
      if (!preloadSession.nextAssignSeq) preloadSession.nextAssignSeq = 1;
      pkg.seq = String(preloadSession.nextAssignSeq++);
      $('#preloadAssignCounterBadge').text(`Next: #${preloadSession.nextAssignSeq}`);
    }

    pkg.status = 'prescanned';
    pkg.scannedAt = Date.now();

    let displaySeq = '#' + pkg.seq;
    let displayAddr = pkg.address;
    const parsedSeq = Number(pkg.seq);
    if (String(pkg.seq) === '?' || (parsedSeq && !Number.isInteger(parsedSeq))) {
      const baseNum = parseInt(pkg.seq);
      if (!isNaN(baseNum)) {
        displaySeq = '~' + baseNum;
        displayAddr = 'Close to: ' + pkg.address;
      }
    } else if (String(pkg.seq) === '0' && preloadScanMode !== 'assign') {
      displaySeq = '#0';
      displayAddr = (pkg.zip ? `[ZIP ${pkg.zip}] ` : '') + pkg.address;
    }

    // 1. Large Sequence Number
    $('#preloadLastSeq').text(displaySeq);
    $('#preloadSeqStatus').text(isAlreadyScanned ? 'ALREADY SCANNED' : 'MATCH · SAVED');

    // 2. High-contrast Driver + Route Badge
    const driverBadgeHtml = `
      <span class="driver-route-badge" style="background:${pkg.routeColor || '#FF5A1F'}; font-size:12px; padding:4px 10px;">
        <i class="bi bi-person-fill"></i> ${escapeHtml((pkg.fullLabel || pkg.driverName || 'DRIVER').toUpperCase())} (${escapeHtml(pkg.routeShortCode || 'R1')})
      </span>
    `;
    $('#preloadLastDriverBadge').html(driverBadgeHtml).show();

    // 3. Details Card
    $('#preloadLastAddress').text(displayAddr);
    $('#preloadLastBarcode').text(pkg.barcode + ' · ' + new Date(pkg.scannedAt).toLocaleTimeString());
    $('#preloadLastDriverRouteTag').html(driverBadgeHtml).show();

    // 4. Audio & Voice Cue (Division of Labor announcement)
    if (isAlreadyScanned) {
      playPreloadAudio('duplicate');
      triggerPreloadHaptic();
      showToast(`Already scanned: [${pkg.routeShortCode || 'R1'}] ${displaySeq} (${pkg.driverName || 'Driver'})`, 'warn');
    } else {
      playPreloadAudio('success');
      triggerPreloadHaptic();

      if (preloadVoiceEnabled) {
        const routeNum = (pkg.routeLabel || '').replace(/[^0-9]/g, '');
        const routePart = routeNum ? 'Route ' + routeNum : '';
        speakText(`${pkg.driverName || 'Driver'} ${routePart}, ${pkg.seq}`);
      }

      showToast(`Scanned [${pkg.routeShortCode || 'R1'}] ${displaySeq} for ${pkg.driverName || 'Driver'}`, 'ok');
    }

    savePreloadSession();
    updatePreloadMetrics();
    renderPreloadTable();

    const row = $(`#preload-row-${pkg.id}`);
    if (row.length) {
      row.addClass('table-success');
      setTimeout(() => row.removeClass('table-success'), 1200);
    }
  } else {
    // Barcode not in ANY driver manifest - MIS-SORT ALERT
    playPreloadAudio('unknown');
    triggerPreloadHaptic();

    if (preloadVoiceEnabled) {
      speakText("Warning: Not in any manifest");
    }

    $('#preloadLastSeq').text('#???');
    $('#preloadSeqStatus').text('NOT IN ANY MANIFEST');
    $('#preloadLastDriverBadge').html('<span class="badge bg-danger fs-6 py-1 px-2"><i class="bi bi-x-octagon-fill me-1"></i>MIS-SORT / NOT IN POOL</span>').show();
    $('#preloadLastAddress').text('NOT FOUND IN ANY UPLOADED DRIVER MANIFEST');
    $('#preloadLastBarcode').text(code + ' · Check package!');
    $('#preloadLastDriverRouteTag').hide().empty();

    showToast(`Barcode ${code} NOT in any driver manifest!`, 'err');
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
  const wrap = $('#preloadCamWrap');
  const placeholder = $('#preloadCamPlaceholder');
  const btnText = $('#preloadCamBtnText');
  const status = $('#preloadCamStatus');
  const statusText = $('#preloadCamStatusText');
  const video = document.getElementById('preloadVideo');

  placeholder.hide();
  wrap.show();
  status.show();
  statusText.text('Starting camera...');
  btnText.text('Turn Camera Off');
  $('#preloadSeqStatus').text('Camera active');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusText.text('Camera access not supported on this browser.');
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
    statusText.text('Camera failed: ' + (err.message || err.name));
    return;
  }

  if (!('BarcodeDetector' in window)) {
    if (typeof ZXing !== 'undefined') {
      try {
        preloadZxingReader = new ZXing.BrowserMultiFormatReader();
      } catch (e) {
        console.warn('ZXing init error:', e);
      }
    }
    if (!preloadZxingReader) {
      statusText.text('Built-in BarcodeDetector not available. Tap to use wedge scanner or enter codes.');
      return;
    }
  } else {
    const FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'upc_a', 'qr_code', 'pdf417', 'data_matrix'];
    try {
      preloadDetector = new BarcodeDetector({ formats: FORMATS });
    } catch (e) {
      preloadDetector = new BarcodeDetector();
    }
  }

  status.hide();
  preloadScanning = true;
  preloadPaused = false;

  if (preloadZxingReader) {
    preloadZxingReader.decodeFromVideoElement(video, (result, err) => {
      if (!preloadScanning || preloadPaused) return;
      if (result && result.getText()) {
        const cVal = result.getText();
        const now = Date.now();
        if (cVal === preloadLastCode && (now - preloadLastCodeTime) < PRELOAD_REPEAT_WINDOW) {
          return;
        }
        preloadLastCode = cVal;
        preloadLastCodeTime = now;
        handlePreloadBarcodeScan(cVal);
      }
    });
  } else {
    loopPreloadCamera();
  }
}

function stopPreloadCamera() {
  preloadScanning = false;
  if (preloadZxingReader) {
    try { preloadZxingReader.reset(); } catch(e) {}
    preloadZxingReader = null;
  }
  if (preloadStream) {
    preloadStream.getTracks().forEach(track => track.stop());
    preloadStream = null;
  }
  $('#preloadCamWrap').hide();
  $('#preloadCamPlaceholder').show();
  $('#preloadCamBtnText').text('Turn Camera On');
  $('#preloadSeqStatus').text('Ready for scan');
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

function renderPreloadExportDropdown() {
  const menu = $('#preloadExportDropdownMenu');
  if (!menu.length) return;
  menu.empty();

  if (!preloadSession || !preloadSession.packages) return;

  const scannedPkgs = preloadSession.packages.filter(p => p.status === 'prescanned');
  const routes = preloadSession.routes || [];

  let html = `
    <li><h6 class="dropdown-header text-uppercase fw-bold text-muted" style="font-size:10.5px;">Box Scanner Integration</h6></li>
    <li>
      <a class="dropdown-item py-2 fw-semibold" href="javascript:void(0)" onclick="sendPreloadToBulkTask('all')">
        <i class="bi bi-upc-scan me-2 text-primary"></i>Send All Scanned to Box Scanner (${scannedPkgs.length})
      </a>
    </li>
  `;

  if (routes.length > 1) {
    routes.forEach(r => {
      const rScanned = scannedPkgs.filter(p => p.routeId === r.id).length;
      html += `
        <li>
          <a class="dropdown-item py-1 ps-4 small" href="javascript:void(0)" onclick="sendPreloadToBulkTask('${r.id}')">
            <span class="driver-route-badge me-2" style="background:${r.color}; font-size:10px;">${escapeHtml(r.shortCode)}</span>
            Send ${escapeHtml(r.fullLabel)} (${rScanned} pkgs)
          </a>
        </li>
      `;
    });
  }

  html += `
    <li><hr class="dropdown-divider"></li>
    <li><h6 class="dropdown-header text-uppercase fw-bold text-muted" style="font-size:10.5px;">Route Planning Apps (Scanned Only)</h6></li>
    <li>
      <a class="dropdown-item py-2 fw-semibold" href="javascript:void(0)" onclick="exportUniversalManifest('circuit', 'all')">
        <i class="bi bi-signpost-split me-2 text-primary"></i>Spoke / Circuit — All Scanned (${scannedPkgs.length})
      </a>
    </li>
  `;

  if (routes.length > 1) {
    routes.forEach(r => {
      const rScanned = scannedPkgs.filter(p => p.routeId === r.id).length;
      html += `
        <li>
          <a class="dropdown-item py-1 ps-4 small" href="javascript:void(0)" onclick="exportUniversalManifest('circuit', '${r.id}')">
            <span class="driver-route-badge me-2" style="background:${r.color}; font-size:10px;">${escapeHtml(r.shortCode)}</span>
            Circuit: ${escapeHtml(r.fullLabel)} (${rScanned} stops)
          </a>
        </li>
      `;
    });
  }

  html += `
    <li>
      <a class="dropdown-item py-2 fw-semibold" href="javascript:void(0)" onclick="exportUniversalManifest('roadwarrior', 'all')">
        <i class="bi bi-compass me-2 text-danger"></i>RoadWarrior — All Scanned (${scannedPkgs.length})
      </a>
    </li>
  `;

  if (routes.length > 1) {
    routes.forEach(r => {
      const rScanned = scannedPkgs.filter(p => p.routeId === r.id).length;
      html += `
        <li>
          <a class="dropdown-item py-1 ps-4 small" href="javascript:void(0)" onclick="exportUniversalManifest('roadwarrior', '${r.id}')">
            <span class="driver-route-badge me-2" style="background:${r.color}; font-size:10px;">${escapeHtml(r.shortCode)}</span>
            RoadWarrior: ${escapeHtml(r.fullLabel)} (${rScanned} stops)
          </a>
        </li>
      `;
    });
  }

  html += `
    <li><hr class="dropdown-divider"></li>
    <li><h6 class="dropdown-header text-uppercase fw-bold text-muted" style="font-size:10.5px;">Raw Warehouse Backup (Unfiltered)</h6></li>
    <li>
      <a class="dropdown-item py-2" href="javascript:void(0)" onclick="exportUniversalManifest('xlsx')">
        <i class="bi bi-file-earmark-excel me-2 text-success"></i>Download Full Manifest (XLSX)
      </a>
    </li>
    <li>
      <a class="dropdown-item py-2" href="javascript:void(0)" onclick="exportUniversalManifest('csv')">
        <i class="bi bi-filetype-csv me-2 text-secondary"></i>Download Clean Manifest (CSV)
      </a>
    </li>
  `;

  menu.html(html);
}

function openPreloadCompleteModal() {
  if (!preloadSession || !preloadSession.packages || !preloadSession.packages.length) {
    showToast('No active session to complete', 'warn');
    return;
  }

  const scannedPkgs = preloadSession.packages.filter(p => p.status === 'prescanned');
  const pendingCount = preloadSession.packages.length - scannedPkgs.length;
  const ratePct = preloadSession.packages.length > 0
    ? Math.round((scannedPkgs.length / preloadSession.packages.length) * 100)
    : 0;

  $('#modalScannedCount').text(scannedPkgs.length);
  $('#modalMissingCount').text(pendingCount);
  $('#modalPendingCount').text(pendingCount);
  $('#modalTotalCount').text(preloadSession.packages.length);
  $('#modalRatePercent').text(ratePct + '%');

  const lines = scannedPkgs.map(p => p.barcode);
  $('#preloadCompleteBarcodeList').val(lines.join('\n'));
  $('#preloadScannedListTextarea').val(lines.join('\n'));

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
  const text = $('#preloadCompleteBarcodeList').val() || $('#preloadScannedListTextarea').val();
  if (!text || !text.trim()) {
    showToast('No scanned barcodes to copy', 'warn');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied scanned barcodes to clipboard', 'ok');
  }).catch(() => {
    $('#preloadCompleteBarcodeList').select();
    showToast('Copy failed — barcodes selected for manual copy', 'err');
  });
}

function copyPreloadScannedList() {
  copyPreloadScannedBarcodes();
}

function downloadPreloadScannedTxt() {
  const text = $('#preloadCompleteBarcodeList').val() || $('#preloadScannedListTextarea').val();
  if (!text || !text.trim()) {
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

// Scanned-Only Route Exports for Circuit/Spoke & RoadWarrior
function exportUniversalManifest(exportType, targetRouteId = 'all') {
  if (!preloadSession || !preloadSession.packages || !preloadSession.packages.length) {
    showToast('No active manifest to export', 'warn');
    return;
  }

  let pkgs = preloadSession.packages;

  // Enforce Scanned-Only for Routing Apps
  if (exportType === 'circuit' || exportType === 'roadwarrior') {
    pkgs = pkgs.filter(p => p.status === 'prescanned');

    if (targetRouteId && targetRouteId !== 'all') {
      pkgs = pkgs.filter(p => p.routeId === targetRouteId);
    }

    if (!pkgs.length) {
      showToast('Cannot export to route: 0 packages have been scanned for this route yet. Please scan packages first.', 'warn');
      return;
    }
  } else if (exportType === 'scanned_only') {
    pkgs = pkgs.filter(p => p.status === 'prescanned');
    if (!pkgs.length) {
      showToast('No scanned packages to export', 'warn');
      return;
    }
  }

  // Sort by sequence number ascending
  pkgs.sort((a, b) => {
    const numA = parseFloat(a.seq) || 999999;
    const numB = parseFloat(b.seq) || 999999;
    return numA - numB;
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const routeObj = targetRouteId && targetRouteId !== 'all' && preloadSession.routes
    ? preloadSession.routes.find(r => r.id === targetRouteId)
    : null;

  const driverSlug = routeObj ? `_${routeObj.driverName}_${routeObj.shortCode}`.replace(/[^a-zA-Z0-9_]/g, '') : '_AllDrivers';
  const baseFilename = (preloadSession.filename || 'manifest').replace(/\.[^/.]+$/, '');

  if (exportType === 'circuit') {
    // Spoke / Circuit format
    // Stop Number, Address, Address Line 2, Postal Code, Recipient Name, Recipient Phone, Package ID, Notes
    const data = pkgs.map((p, idx) => ({
      'Stop Number': (p.seq && p.seq !== '?' && p.seq !== '0') ? p.seq : (idx + 1),
      'Address': p.primaryAddr || p.address,
      'Address Line 2': p.unit || '',
      'Postal Code': p.zip || '',
      'Recipient Name': p.recipient || '',
      'Recipient Phone': p.phone || '',
      'Package ID': p.barcode,
      'Notes': `[${p.routeShortCode || 'R1'}] ${p.driverName || 'Driver'} | Status: Scanned`
    }));
    downloadExportFile(data, `${baseFilename}${driverSlug}_circuit_${stamp}`, 'csv');
    showToast(`Exported ${data.length} scanned stops for Spoke / Circuit`, 'ok');
  } else if (exportType === 'roadwarrior') {
    // RoadWarrior format
    // Stop Number, Street Address, Postal Code, Notes, Package ID
    const data = pkgs.map((p, idx) => ({
      'Stop Number': (p.seq && p.seq !== '?' && p.seq !== '0') ? p.seq : (idx + 1),
      'Street Address': p.address,
      'Postal Code': p.zip || '',
      'Notes': `[${p.routeShortCode || 'R1'}] ${p.driverName || 'Driver'}` + (p.recipient ? ' | ' + p.recipient : ''),
      'Package ID': p.barcode
    }));
    downloadExportFile(data, `${baseFilename}${driverSlug}_roadwarrior_${stamp}`, 'csv');
    showToast(`Exported ${data.length} scanned stops for RoadWarrior`, 'ok');
  } else if (exportType === 'xlsx') {
    // Full Clean XLSX Backup
    const data = pkgs.map((p, idx) => ({
      'Stop #': (p.seq && p.seq !== '?' && p.seq !== '0') ? p.seq : (idx + 1),
      'Driver': p.driverName || '',
      'Route': p.fullLabel || '',
      'Short Code': p.routeShortCode || '',
      'Barcode': p.barcode,
      'Street Address': p.primaryAddr || p.address,
      'Unit / Apt': p.unit || '',
      'Zip Code': p.zip || '',
      'City': p.city || '',
      'State': p.state || '',
      'Recipient Name': p.recipient || '',
      'Phone': p.phone || '',
      'Weight': p.weight || '',
      'Status': p.status,
      'Scanned Time': p.scannedAt ? new Date(p.scannedAt).toLocaleTimeString() : ''
    }));
    downloadExportFile(data, `${baseFilename}_backup_${stamp}`, 'xlsx');
    showToast(`Exported ${data.length} packages to Excel`, 'ok');
  } else {
    // Clean CSV
    const data = pkgs.map((p, idx) => ({
      'Stop #': (p.seq && p.seq !== '?' && p.seq !== '0') ? p.seq : (idx + 1),
      'Driver': p.driverName || '',
      'Route Code': p.routeShortCode || '',
      'Barcode': p.barcode,
      'Street Address': p.primaryAddr || p.address,
      'Unit / Apt': p.unit || '',
      'Zip Code': p.zip || '',
      'City': p.city || '',
      'State': p.state || '',
      'Recipient Name': p.recipient || '',
      'Phone': p.phone || '',
      'Status': p.status,
      'Scanned Time': p.scannedAt ? new Date(p.scannedAt).toLocaleTimeString() : ''
    }));
    downloadExportFile(data, `${baseFilename}_clean_${stamp}`, 'csv');
    showToast(`Exported ${data.length} packages to CSV`, 'ok');
  }
}

function downloadExportFile(dataRows, filename, ext) {
  if (ext === 'xlsx' && typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stops");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } else {
    let csv = '';
    if (typeof Papa !== 'undefined') {
      csv = Papa.unparse(dataRows);
    } else {
      if (!dataRows.length) return;
      const headers = Object.keys(dataRows[0]);
      csv = headers.join(',') + '\n';
      dataRows.forEach(r => {
        csv += headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',') + '\n';
      });
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

// Push scanned packages directly into Box Scanner (Bulk Task)
function sendPreloadToBulkTask(targetRouteId = 'all') {
  if (!preloadSession || !preloadSession.packages) return;

  let scannedPkgs = preloadSession.packages.filter(p => p.status === 'prescanned');
  if (targetRouteId && targetRouteId !== 'all') {
    scannedPkgs = scannedPkgs.filter(p => p.routeId === targetRouteId);
  }

  if (!scannedPkgs.length) {
    showToast('No pre-scanned packages found to send to Box Scanner', 'warn');
    return;
  }

  // Sort strictly by Sequence Number so driver can scan off screen in stop order
  scannedPkgs.sort((a, b) => {
    const numA = parseFloat(a.seq) || 999999;
    const numB = parseFloat(b.seq) || 999999;
    return numA - numB;
  });

  // Format as: "BARCODE, [DRIVER-R1] Stop #X - ADDRESS"
  const entries = scannedPkgs.map(p => `${p.barcode}, [${p.routeShortCode || 'R1'}] Stop #${p.seq} - ${p.address}`);
  $('#barcodesBatchText').val(entries.join('\n'));

  // Close modal if open
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
    showToast(`Loaded ${scannedPkgs.length} scanned package(s) into Box Scanner in stop order!`, 'ok');
  }, 300);
}

// Function to handle barcodes piped from the standalone scanner iframe
window.sendScannerToBulkTask = function(barcodesArray) {
  if (!barcodesArray || !barcodesArray.length) return;
  
  // The scanner array might contain just strings. If they are objects, map them.
  // Assuming they are just strings (the lines array from scanner).
  const entries = barcodesArray.filter(b => b.trim().length > 0);
  
  // Append to whatever is already in the bulk task text box, or overwrite
  // It's usually best to append if they pipe multiple times, or overwrite if clean. 
  // We will overwrite to be consistent with sendPreloadToBulkTask
  $('#barcodesBatchText').val(entries.join('\n'));
  
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
    showToast(`Loaded ${entries.length} scanned barcode(s) into Bulk Task`, 'ok');
  }, 300);
};

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

// --- Slim-Line OCR & Barcode Reader Logic ---
let ocrStream = null;
let currentOcrTargetId = 'barcodeNumber';
let ocrTorchActive = false;
let ocrModalInstance = null;
let uploadedImgObject = null;
let currentCropPercent = 50;
let detectedBarcodeCandidates = [];

function openSlimOcrReader(targetInputId) {
  currentOcrTargetId = targetInputId || 'barcodeNumber';
  detectedBarcodeCandidates = [];

  // Reset UI
  returnToOcrLiveCamera();
  $('#ocrResultArea').hide();
  $('#ocrActionRow').show();
  $('#ocrDetectedInput').val('');
  $('#ocrCandidateSection').hide();
  $('#ocrCandidateList').empty();
  $('#ocrCamStatus').show();
  $('#ocrCamStatusText').text('Starting camera...');
  $('#ocrTorchBtn').hide();
  ocrTorchActive = false;

  const modalEl = document.getElementById('ocrReaderModal');
  if (window.bootstrap && bootstrap.Modal) {
    ocrModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    ocrModalInstance.show();
  } else {
    $('#ocrReaderModal').modal('show');
  }

  startOcrCamera();
}

async function startOcrCamera() {
  const video = document.getElementById('ocrVideo');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('#ocrCamStatusText').text('Camera access not supported on this device.');
    return;
  }

  if (ocrStream) {
    ocrStream.getTracks().forEach(t => t.stop());
    ocrStream = null;
  }

  try {
    ocrStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    video.srcObject = ocrStream;
    await video.play();
    $('#ocrCamStatus').hide();

    // Check torch support
    const track = ocrStream.getVideoTracks()[0];
    if (track && track.getCapabilities && track.getCapabilities().torch) {
      $('#ocrTorchBtn').show();
    }
  } catch (err) {
    console.error('OCR Camera Error:', err);
    $('#ocrCamStatusText').text('Camera access failed: ' + (err.message || err.name));
  }
}

async function toggleOcrTorch() {
  if (!ocrStream) return;
  const track = ocrStream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return;
  
  ocrTorchActive = !ocrTorchActive;
  try {
    await track.applyConstraints({
      advanced: [{ torch: ocrTorchActive }]
    });
    $('#ocrTorchBtn').toggleClass('btn-warning', ocrTorchActive);
  } catch(e) {
    console.warn('Torch toggle failed:', e);
  }
}

function closeSlimOcrReader() {
  if (ocrStream) {
    ocrStream.getTracks().forEach(t => t.stop());
    ocrStream = null;
  }
  const modalEl = document.getElementById('ocrReaderModal');
  if (window.bootstrap && bootstrap.Modal) {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  } else {
    $('#ocrReaderModal').modal('hide');
  }
}

function resumeOcrCamera() {
  $('#ocrResultArea').slideUp('fast');
  $('#ocrActionRow').slideDown('fast');
  $('#ocrCaptureBtn').prop('disabled', false).html('<i class="bi bi-camera-fill me-2 fs-5"></i><span>Capture & Read</span>');
}

function returnToOcrLiveCamera() {
  $('#ocrUploadContainer').hide();
  $('#ocrLiveCamSection').show();
  $('#ocrActionRow').show();
  $('#ocrResultArea').hide();
  startOcrCamera();
}

// --------------------- Interactive Upload & Cropper ---------------------

function handleOcrImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  // Stop live video to save battery and memory
  if (ocrStream) {
    ocrStream.getTracks().forEach(t => t.stop());
    ocrStream = null;
  }

  $('#ocrLiveCamSection').hide();
  $('#ocrActionRow').hide();
  $('#ocrResultArea').hide();
  $('#ocrUploadContainer').slideDown('fast');

  const img = new Image();
  img.onload = function() {
    uploadedImgObject = img;
    const uploadImgEl = document.getElementById('ocrUploadedImg');
    uploadImgEl.src = img.src;

    // Reset crop slider to 50%
    currentCropPercent = 50;
    $('#ocrCropSlider').val(50);
    updateCropPositionFromSlider(50);
  };
  img.src = URL.createObjectURL(file);
}

function updateCropPositionFromSlider(val) {
  currentCropPercent = parseInt(val, 10);
  const cropBox = $('#ocrUploadCropBox');
  cropBox.css('top', currentCropPercent + '%');
  
  let label = 'Center (' + currentCropPercent + '%)';
  if (currentCropPercent < 35) label = 'Top (' + currentCropPercent + '%)';
  else if (currentCropPercent > 65) label = 'Bottom (' + currentCropPercent + '%)';
  $('#ocrCropPosLabel').text(label);
}

// Scan the interactive crop slit from uploaded image
async function scanSelectedUploadArea() {
  if (!uploadedImgObject) return;

  const btn = $('#ocrScanSelectedBtn');
  btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>Scanning Slit...');
  $('#ocrResultArea').slideDown('fast');
  $('#ocrResultTypeBadge').text('Extracting...');
  $('#ocrDetectedInput').val('Reading digits from slit...');

  const img = uploadedImgObject;
  const cropCanvas = document.createElement('canvas');
  
  // Height is 18% of image height
  const slitH = Math.max(50, Math.floor(img.height * 0.18));
  const slitW = Math.floor(img.width * 0.94);
  const cropX = Math.floor((img.width - slitW) / 2);
  
  // Vertical position from slider percent
  const centerTargetY = Math.floor(img.height * (currentCropPercent / 100));
  const cropY = Math.max(0, Math.min(img.height - slitH, centerTargetY - Math.floor(slitH / 2)));

  cropCanvas.width = slitW;
  cropCanvas.height = slitH;
  const ctx = cropCanvas.getContext('2d');
  ctx.drawImage(img, cropX, cropY, slitW, slitH, 0, 0, slitW, slitH);

  // Update snippet canvas
  const snip = document.getElementById('ocrSnippetCanvas');
  snip.width = slitW;
  snip.height = slitH;
  snip.getContext('2d').drawImage(cropCanvas, 0, 0);

  await processCroppedOcrImage(cropCanvas);
  btn.prop('disabled', false).html('<i class="bi bi-crop me-1"></i>Scan Selected Slit');
}

// Scan entire uploaded picture for all barcodes & tracking numbers
async function scanEntireUploadImage() {
  if (!uploadedImgObject) return;

  const btn = $('#ocrScanFullBtn');
  btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>Scanning Full Picture...');
  $('#ocrResultArea').slideDown('fast');
  $('#ocrResultTypeBadge').text('Full Scan...');
  $('#ocrDetectedInput').val('Searching entire image for barcodes & tracking numbers...');

  const img = uploadedImgObject;
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = img.width;
  fullCanvas.height = img.height;
  const ctx = fullCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Show full image preview on snippet canvas
  const snip = document.getElementById('ocrSnippetCanvas');
  snip.width = img.width;
  snip.height = img.height;
  snip.getContext('2d').drawImage(fullCanvas, 0, 0);

  await scanFullImageForCandidates(fullCanvas);
  btn.prop('disabled', false).html('<i class="bi bi-aspect-ratio me-1"></i>Scan Full Picture');
}

// --------------------- Live Video Capture ---------------------

async function captureAndExtractSlimOcr() {
  const video = document.getElementById('ocrVideo');
  const aimBox = document.getElementById('ocrAimBox');
  const snippetCanvas = document.getElementById('ocrSnippetCanvas');
  const captureBtn = $('#ocrCaptureBtn');

  if (!video || !aimBox || video.videoWidth === 0 || video.videoHeight === 0) {
    showToast('Camera feed not ready yet', 'warn');
    return;
  }

  captureBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span><span>Scanning...</span>');
  $('#ocrResultArea').slideDown('fast');
  $('#ocrResultTypeBadge').text('Extracting...');
  $('#ocrDetectedInput').val('Reading digits...');

  // Compute bounding box of ocrAimBox relative to ocrVideo display area
  const videoRect = video.getBoundingClientRect();
  const boxRect = aimBox.getBoundingClientRect();

  const displayW = videoRect.width;
  const displayH = videoRect.height;
  const nativeW = video.videoWidth;
  const nativeH = video.videoHeight;

  const scale = Math.max(displayW / nativeW, displayH / nativeH);
  const renderedW = nativeW * scale;
  const renderedH = nativeH * scale;
  const offsetX = (renderedW - displayW) / 2;
  const offsetY = (renderedH - displayH) / 2;

  const boxXOnRendered = (boxRect.left - videoRect.left) + offsetX;
  const boxYOnRendered = (boxRect.top - videoRect.top) + offsetY;

  const cropX = Math.max(0, Math.floor(boxXOnRendered / scale));
  const cropY = Math.max(0, Math.floor(boxYOnRendered / scale));
  const cropW = Math.min(nativeW - cropX, Math.floor(boxRect.width / scale));
  const cropH = Math.min(nativeH - cropY, Math.floor(boxRect.height / scale));

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const ctx = cropCanvas.getContext('2d');
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  snippetCanvas.width = cropW;
  snippetCanvas.height = cropH;
  const snipCtx = snippetCanvas.getContext('2d');
  snipCtx.drawImage(cropCanvas, 0, 0);

  await processCroppedOcrImage(cropCanvas);
  captureBtn.prop('disabled', false).html('<i class="bi bi-camera-fill me-2 fs-5"></i><span>Capture & Read</span>');
}

// --------------------- Decoding & Extraction Core ---------------------

async function decodeBarcodeFromCanvas(canvas) {
  // 1. Native BarcodeDetector
  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({
        formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'upc_a', 'qr_code', 'data_matrix', 'pdf417']
      });
      const codes = await detector.detect(canvas);
      if (codes && codes.length > 0 && codes[0].rawValue) {
        return codes[0].rawValue;
      }
    } catch(e) {}
  }

  // 2. ZXing low-level Canvas Luminance Source (synchronous & blazing fast)
  if (typeof ZXing !== 'undefined') {
    try {
      const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
      const reader = new ZXing.MultiFormatReader();
      const result = reader.decode(binaryBitmap);
      if (result && result.getText()) {
        return result.getText();
      }
    } catch(e) {}

    // 3. ZXing BrowserMultiFormatReader via Image element
    try {
      const zxReader = new ZXing.BrowserMultiFormatReader();
      const img = new Image();
      img.src = canvas.toDataURL('image/png');
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const res = await zxReader.decodeFromImageElement(img);
      if (res && res.getText()) {
        return res.getText();
      }
    } catch(e) {}
  }

  return null;
}

// Process a single cropped strip (Barcode + Tesseract PSM 7)
async function processCroppedOcrImage(cropCanvas) {
  let detectedCode = await decodeBarcodeFromCanvas(cropCanvas);
  let detectionSource = detectedCode ? 'Barcode 100%' : '';
  const candidates = [];

  if (detectedCode) {
    candidates.push({ code: detectedCode, type: 'Barcode' });
  }

  // If no barcode or to find additional tracking digits, run Tesseract OCR
  if (typeof Tesseract !== 'undefined') {
    try {
      const processedCanvas = document.createElement('canvas');
      const targetH = Math.max(120, cropCanvas.height * 2);
      const targetW = Math.round(cropCanvas.width * (targetH / cropCanvas.height));
      processedCanvas.width = targetW;
      processedCanvas.height = targetH;
      const pCtx = processedCanvas.getContext('2d');
      pCtx.drawImage(cropCanvas, 0, 0, targetW, targetH);
      
      const imgData = pCtx.getImageData(0, 0, targetW, targetH);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        const binary = v > 135 ? 255 : 0;
        d[i] = binary; d[i+1] = binary; d[i+2] = binary;
      }
      pCtx.putImageData(imgData, 0, 0);

      const res = await Tesseract.recognize(processedCanvas, 'eng', { tessedit_pageseg_mode: '7' });
      const rawOcr = (res && res.data && res.data.text) ? res.data.text.trim() : '';

      if (rawOcr) {
        const extracted = extractBarcodeCandidatesFromText(rawOcr);
        extracted.forEach(item => {
          if (!candidates.find(c => c.code === item.code)) {
            candidates.push(item);
          }
        });
        if (!detectedCode && candidates.length > 0) {
          detectedCode = candidates[0].code;
          detectionSource = candidates[0].type || 'OCR Text Line';
        }
      }
    } catch(err) {
      console.warn('OCR processing error:', err);
    }
  }

  displayDetectedResults(detectedCode, detectionSource, candidates);
}

// Scan entire picture: searches barcodes across the whole image + runs full OCR
async function scanFullImageForCandidates(fullCanvas) {
  const candidates = [];

  // 1. Decode barcode from full image
  const fullBarcode = await decodeBarcodeFromCanvas(fullCanvas);
  if (fullBarcode) {
    candidates.push({ code: fullBarcode, type: 'Barcode' });
  }

  // 2. Decode multiple horizontal strips (in case barcode is elsewhere on label)
  const stripCount = 4;
  const stripH = Math.floor(fullCanvas.height / stripCount);
  for (let s = 0; s < stripCount; s++) {
    const sCanvas = document.createElement('canvas');
    sCanvas.width = fullCanvas.width;
    sCanvas.height = stripH;
    sCanvas.getContext('2d').drawImage(fullCanvas, 0, s * stripH, fullCanvas.width, stripH, 0, 0, fullCanvas.width, stripH);
    const stripCode = await decodeBarcodeFromCanvas(sCanvas);
    if (stripCode && !candidates.find(c => c.code === stripCode)) {
      candidates.push({ code: stripCode, type: 'Barcode' });
    }
  }

  // 3. Run full-image OCR and parse lines for tracking numbers / barcodes
  if (typeof Tesseract !== 'undefined') {
    try {
      const res = await Tesseract.recognize(fullCanvas, 'eng');
      const text = (res && res.data && res.data.text) ? res.data.text : '';
      if (text) {
        const found = extractBarcodeCandidatesFromText(text);
        found.forEach(item => {
          if (!candidates.find(c => c.code === item.code)) {
            candidates.push(item);
          }
        });
      }
    } catch(e) {
      console.warn('Full image OCR error:', e);
    }
  }

  const primaryCode = candidates.length > 0 ? candidates[0].code : null;
  const primaryType = candidates.length > 0 ? candidates[0].type : '';
  displayDetectedResults(primaryCode, primaryType, candidates);
}

// Intelligent extractor: converts text into clean list of candidate barcodes/tracking numbers (no clustered words!)
function extractBarcodeCandidatesFromText(text) {
  if (!text) return [];
  const list = [];
  const seen = new Set();

  function addCandidate(code, carrier) {
    const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length >= 7 && !seen.has(clean)) {
      seen.add(clean);
      list.push({ code: clean, type: carrier });
    }
  }

  // Known carrier regexes
  const onTracMatches = text.match(/(1LS[A-Za-z0-9]{12}|D100[A-Za-z0-9]{11}|C12[A-Za-z0-9]{12})/gi) || [];
  onTracMatches.forEach(m => addCandidate(m, 'OnTrac'));

  const spxMatches = text.match(/(SPX[A-Za-z0-9]{8,24})/gi) || [];
  spxMatches.forEach(m => addCandidate(m, 'SpeedX'));

  const upsMatches = text.match(/(1Z[A-Za-z0-9]{16})/gi) || [];
  upsMatches.forEach(m => addCandidate(m, 'UPS'));

  const fedexMatches = text.match(/\b(\d{12}|\d{15}|\d{20}|\d{22})\b/g) || [];
  fedexMatches.forEach(m => addCandidate(m, 'FedEx'));

  const uspsMatches = text.match(/\b(9[1-5]\d{20,24}|\d{20,30}|420\d{20,30})\b/g) || [];
  uspsMatches.forEach(m => addCandidate(m, 'USPS'));

  const tbaMatches = text.match(/(TBA[0-9]{12})/gi) || [];
  tbaMatches.forEach(m => addCandidate(m, 'Amazon'));

  // Split lines and tokens to find other clean numbers / barcodes
  const stopWords = new Set(['DELIVERY', 'STREET', 'AVENUE', 'WEIGHT', 'POUNDS', 'CUSTOMER', 'ATLANTA', 'GEORGIA', 'PRIORITY', 'GROUND', 'PACKAGE', 'CARRIER', 'SERVICE', 'ADDRESS', 'SUITE', 'TRACKING', 'NUMBER', 'SHIPTO', 'RETURN']);
  const tokens = text.split(/[\s,\-_|/\\:;\n\r]+/);
  for (const t of tokens) {
    const clean = t.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length >= 8 && clean.length <= 34) {
      if (!stopWords.has(clean)) {
        // Must contain at least 2 digits to qualify as a barcode or tracking number
        const digitCount = (clean.match(/\d/g) || []).length;
        if (digitCount >= 2 && !seen.has(clean)) {
          addCandidate(clean, 'Tracking #');
        }
      }
    }
  }

  return list;
}

// Display results and candidate pills
function displayDetectedResults(primaryCode, primaryType, candidates) {
  const candidateSec = $('#ocrCandidateSection');
  const candidateList = $('#ocrCandidateList');
  candidateList.empty();

  if (candidates && candidates.length > 0) {
    candidateSec.show();
    candidates.forEach((c, idx) => {
      const isSelected = (c.code === primaryCode) || (idx === 0);
      const activeClass = isSelected ? ' active' : '';
      const badgeText = c.type || 'Code';
      const pill = $('<button type="button" class="ocr-candidate-pill' + activeClass + '" onclick="selectOcrCandidate(\'' + c.code + '\', this)"><i class="bi bi-upc-scan me-1"></i><span>' + c.code + '</span><span class="carrier-badge">' + badgeText + '</span></button>');
      candidateList.append(pill);
    });
  } else {
    candidateSec.hide();
  }

  if (primaryCode) {
    $('#ocrResultTypeBadge').text(primaryType || 'Detected').css('background', 'var(--success)');
    $('#ocrDetectedInput').val(primaryCode);
    showToast('Detected: ' + primaryCode, 'ok');
  } else {
    $('#ocrResultTypeBadge').text('No Barcode Found').css('background', 'var(--warn)');
    $('#ocrDetectedInput').val('').attr('placeholder', 'No barcode found. Adjust slit or try another photo.');
    showToast('Could not find barcode. Adjust slit and tap Scan.', 'warn');
  }
}

function selectOcrCandidate(code, btnEl) {
  $('#ocrDetectedInput').val(code);
  $('.ocr-candidate-pill').removeClass('active');
  if (btnEl) $(btnEl).addClass('active');
  showToast('Selected ' + code, 'ok');
}

function applyOcrResult() {
  const val = $('#ocrDetectedInput').val().trim();
  if (!val) {
    showToast('No text to use', 'warn');
    return;
  }

  const targetInput = $('#' + currentOcrTargetId);
  if (targetInput.length) {
    targetInput.val(val).trigger('input');
    showToast('Inserted ' + val, 'ok');
  }

  closeSlimOcrReader();
}
