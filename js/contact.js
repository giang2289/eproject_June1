// and here's the trick (works everywhere)
function r(f){/in/.test(document.readyState)?setTimeout('r('+f+')',9):f()}
// use like
r(function(){
   
});
var mapObj = null;
var defaultCoord = [10.7743, 106.6669]; // coord mặc định, 9 giữa HCMC
var zoomLevel = 14;
var mapConfig = {
    attributionControl: false, // để ko hiện watermark nữa
    center: defaultCoord, // vị trí map mặc định hiện tại
    zoom: zoomLevel, // level zoom
};

window.onload = function() {
    // init map
    
    mapObj = L.map('map', {attributionControl: false}).setView(defaultCoord, zoomLevel);
    // tạo marker
    // tạo marker


		var marker = L.marker([10.7743, 106.6669]).addTo(mapObj).on('click',function(e){console.log(this)});
        var marker1 = L.marker([10.7800, 106.6669]).addTo(mapObj).on('click',function(e){alert(this.getLatLng())});
		// tạo popup và gán vào marker vừa tạo
		var popup = L.popup();
		popup.setContent("<b>Seth Phát</b> <br> Hello World Nà");
        marker.bindPopup(popup);
   
    // add tile để map có thể hoạt động, xài free từ OSM
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapObj);
    
 
};

