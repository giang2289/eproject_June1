$(function(){
 
    
    // price
    $('#slider-range').slider({
    range: true,
    min: 40 ,
    max: 600,
    values: [50, 570],
    slide: function(event, ui) {
      $('#amount1').val('$' + ui.values[0]);
      $('#amount2').val( '$' + ui.values[1]);
    }
  });
  $('#amount1').val(
    '$' +
      $('#slider-range').slider('values', 0) 
   
  );
  $('#amount2').val(
   
      '$' +
      $('#slider-range').slider('values', 1)
  );
    // end price
  });