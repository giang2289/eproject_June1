// and here's the trick (works everywhere)
function r(f){/in/.test(document.readyState)?setTimeout('r('+f+')',9):f()}
// use like
r(function(){
   
});

r(function(exports) {
    "use strict";

    function initMap() {
        var map;
      exports.map = new google.maps.Map(document.getElementById("map"), {
        center: {
          lat: -34.397,
          lng: 150.644
        },
        zoom: 8
      });
    }

    exports.initMap = initMap;
  })((this.window = this.window || {}));