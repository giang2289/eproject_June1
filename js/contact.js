// and here's the trick (works everywhere)
function r(f){/in/.test(document.readyState)?setTimeout('r('+f+')',9):f()}
// use like
r(function(){
   
});
var mapObj = null;
var defaultCoord = [10.7743, 106.6669]; // coord mặc định, 9 giữa HCMC
var zoomLevel = 13;
var mapConfig = {
    attributionControl: false, // để ko hiện watermark nữa
    center: defaultCoord, // vị trí map mặc định hiện tại
    zoom: zoomLevel, // level zoom
};

window.onload = function() {
    // init map
    mapObj = L.map('map', {attributionControl: false}).setView(defaultCoord, zoomLevel);
    
    // add tile để map có thể hoạt động, xài free từ OSM
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapObj);
};

