// and here's the trick (works everywhere)
function r(f){/in/.test(document.readyState)?setTimeout('r('+f+')',9):f()}
// use like
r(function(){
   
});
var mapObj = null;
var defaultCoord = [21.0227788, 105.8194541]; // default position, Ha Noi city center
var zoomLevel = 14;
var mapConfig = {
    attributionControl: false, // để ko hiện watermark nữa
    center: defaultCoord, // vị trí map mặc định hiện tại
    zoom: zoomLevel, // level zoom
};




  var map = L.map('map', {
      center: [48,14],
      zoom: 6,
     animate: true, duration: 1
  });
  
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
     maxZoom: 18,
     attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox.streets'
  }).addTo(map);

  markerLayer = L.layerGroup([]).addTo(map);
   
  function createMarker(coords, title, info, image, source) {
    var marker, content;
  
    content = '<b><font size="6">' + title + '</font></b><br/>' + info + '<br> <img src="' + image + '"><a href="' + source + '" target="_blank"><button>Source</button></a>'
    marker = L.marker(coords).addTo(markerLayer);
    marker.bindPopup(content);
    
    map.on('', function(evt) {
      var id = L.Util.stamp(evt.target);
      if (document.getElementById(id) != null) return; 
      var sidebarElement, infoPart, removePart;
      sidebarElement = L.DomUtil.create('div', 'sidebarElement', document.getElementById('sidebar'));
      sidebarElement.id = id;
      infoPart = L.DomUtil.create('div', 'infoSidebarElement', sidebarElement);
      infoPart.innerHTML = content;
      L.DomEvent.on(infoPart, 'click', function(evt) {
        var marker = markerLayer.getLayer(this.id);
        marker.closePopup();
        map.panTo(marker.getLatLng());
        marker.bounce(3);
      }, sidebarElement);
      removePart = L.DomUtil.create('div', 'removeSidebarElement', sidebarElement);
     
      
    });
  }
  
  createMarker([49, 14], 'Title 1', 'Info 1', '', ''); 
  createMarker([47, 12], 'Title 2', 'Info 2', '', ''); 
    createMarker([50, 14], 'Title 3', 'Info 3', '', ''); 


// file json postion


// window.onload = function() {
//     // init map
//     // Set default location
//     //mapObj = L.map('map', {attributionControl: false}).setView(defaultCoord, zoomLevel);
//     // Create marker
//         var map = L.map('map').setView([21.0227788, 105.8194541], 14);
//         L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
//             maxZoom: 18,
//             attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
//                 '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
//                 'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
//             id: 'mapbox/light-v9',
//             tileSize: 512,
//             zoomOffset: -1
//         }).addTo(map);
//             // funtion load marker for each feature
//             function onEachFeature(feature, layer) {
//                 var popupContent = "<p>I started out as a GeoJSON " +
//                         feature.geometry.type + ", but now I'm a Leaflet vector!</p>";

//                 if (feature.properties && feature.properties.popupContent) {
//                     popupContent += feature.properties.popupContent;
//                 }

//                 layer.bindPopup(popupContent);
//             }

//             // get data from geoJson
//                 L.geoJSON([bicycleRental], {

//                     style: function (feature) {
//                         return feature.properties && feature.properties.style;
//                     },

//                     onEachFeature: onEachFeature,

//                     pointToLayer: function (feature, latlng) {
//                         return L.circleMarker(latlng, {
//                             radius: 8,
//                             fillColor: "#ff7800",
//                             color: "#000",
//                             weight: 1,
//                             opacity: 1,
//                             fillOpacity: 0.8
//                         });
//                     }
//                 }).addTo(map);
//         var baosonParadise = L.marker([21.0002543, 105.7267757]).bindPopup('Bao Son Paradise, CO.'),
//             bkAptech    = L.marker([21.0447311, 105.7830806]).bindPopup('Bach Khoa ApTech, CO.'),
//             zoo    = L.marker([21.0305852, 105.8033129]).bindPopup('Zoo, CO.'),
//             grhMarket    = L.marker([21.0410644, 105.7817036]).bindPopup('Green Home Market, CO.');

//      //Add marker to map by using LayerGroup class   
// 	   var cities = L.layerGroup([baosonParadise, bkAptech, zoo, grhMarket]);
//        // Create those base layers and add the default ones to the map
//        var grayscale = L.tileLayer(mapboxUrl, {id: 'MapID', tileSize: 512, zoomOffset: -1, attribution: mapboxAttribution}),
//         streets   = L.tileLayer(mapboxUrl, {id: 'MapID', tileSize: 512, zoomOffset: -1, attribution: mapboxAttribution});

//        //
//        var map = L.map('map', {
//         center: [21.0227788, 105.8194541],
//         zoom: 14,
//         layers: [grayscale, cities]
//         });
//        //
//            var baseMaps = {
//         "Grayscale": grayscale,
//         "Streets": streets
//     };

//         var overlayMaps = {
//             "Cities": cities
//         };
//     L.control.layers(baseMaps, overlayMaps).addTo(map);
// 		// tạo popup và gán vào marker vừa tạo
		
   
  

//     // add tile để map có thể hoạt động, xài free từ OSM
//     L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
//         attribution: '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
//     }).addTo(mapObj);
    
 
// };


