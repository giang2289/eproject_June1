$(document).ready(function(){
    $(".owl-carousel").owlCarousel();
  });   

  // and here's the trick (works everywhere)
function r(f){/in/.test(document.readyState)?setTimeout('r('+f+')',9):f()}
// use like
r(function(){
   
});
var mapObj = null;
var defaultCoord = [21.0227788, 105.8194541]; // default position, Ha Noi city center
var zoomLevel = 12;
var mapConfig = {
    attributionControl: false, // not show watermark
    center: defaultCoord, // vị trí map mặc định hiện tại
    zoom: zoomLevel, // level zoom
};




  var map = L.map('map', {
      center: defaultCoord, // main coord 
      zoom: zoomLevel,
         animate: true, duration: 1,
         zoomControl: false
  });
        L.control.zoom({
           position:'topright'
      }).addTo(map);
        
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
     maxZoom: 18,
     attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox.streets'
  }).addTo(map);

  markerLayer = L.layerGroup([]).addTo(map);
   
  function createMarker(coords, title, info,  source) {
    var marker, content;
  
    content = '<b><font size="4">' + title + '</font></b><br/>' + info + '<br> <a href= "'  + source + '" target="_blank"><button>See on big map</button></a>'
    marker = L.marker(coords).addTo(markerLayer);
    marker.bindPopup(content);
    
    marker.on('click', function(evt) {
      var id = L.Util.stamp(evt.target);
      if (document.getElementById(id) != null) return; 
      var sidebarElement, infoPart ;
      sidebarElement = L.DomUtil.create('div', 'sidebarElement', document.getElementById('sidebar'));
      sidebarElement.id = id;
      infoPart = L.DomUtil.create('div', 'infoSidebarElement', sidebarElement);
      infoPart.innerHTML = content;
      L.DomEvent.on(infoPart, 'click', function(evt) {
        var marker = markerLayer.getLayer(this.id);
        marker.closePopup();
        map.panTo(marker.getLatLng());
        
      }, sidebarElement);
     
     
      
    });
  }
  
  createMarker([21.0463433, 105.7833681], 'BachKhoaAptech', 'Our School', 'https://www.google.com/maps?saddr=Current+Location&daddr=21.0463433,105.7833681'); 
  createMarker([21.1103785, 105.9463062], 'Ly Thai To High School', 'My High School', 'https://www.google.com/maps?saddr=Current+Location&daddr=21.1103785,105.9463062'); 
    createMarker([21.0291512, 105.8512106], 'Hoan Kiem Lake', 'Turtle Lake', 'https://www.google.com/maps?saddr=Current+Location&daddr=21.0291512,105.8512106'); 


// file json postion





