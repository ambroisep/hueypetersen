!function(window, document, $, Pug) {
  var ListView = infinity.ListView,
      ListItem = infinity.ListItem,
      _ = require('underscore'),
      Pugs = Pug.images,
      PugNames = Pug.names,
      PugTaglines = Pug.taglines,
      PugStorage = Pug.storage;

  var template = _.template($('#demo-template').html()),
      pugTemplate = _.template($('#demo-pug-template').html());

  var columns = $('.list-view'),
      pugCount = 0;

  if(Pug.config.infinityOn) {
    columns.each(function() {
      var listView = new ListView($(this), {
        lazy: function() {
          $(this).find('.pug').each(function() {
            var $ref = $(this);
            $ref.attr('src', $ref.attr('data-original'));
          });
        }
      });
      $(this).data('listView', listView);
    });
  }


  function pug() {
    var rotate, rotateRight, rotateLeft, name, caption, pugData;
    pugCount++;

    tagline = _.template(PugTaglines[
      Math.floor(Math.random() * PugTaglines.length)
    ]);
    name = PugNames[Math.floor(Math.random() * PugNames.length)];
    caption = tagline({name: name});
    pugData = Pugs[Math.floor(Math.random() * Pugs.length)];

    rotate = Math.random() > 0.5;
    rotateRight = rotate && Math.random() > 0.5;
    rotateLeft = rotate && !rotateRight;
    saved = PugStorage.check(pugData.src, name, caption);

    return pugTemplate({
      pug: pugData,
      title: name,
      caption: caption,
      saved: saved,
      price: Math.floor(Math.random() * 100 + 10),
      rotateRight: rotateRight,
      rotateLeft: rotateLeft
    });
  }

  function batch(num) {
    var index = 0, length = columns.length, $column = $(columns[0]), pugs = [], columnHeights = [0, 0, 0];

    // add them all
    $column.css('position', 'relative');
    for(index = 0; index < num * length; index++) {
      var $pug = $(pug());
      $pug.css('display', 'hidden')
        .css('position', 'absolute');
      $column.append($pug);
      pugs.push($pug);
    }

    // get the heights -- tuple of [pug, height]
    pugs = pugs.map(function(pug) { return [pug, pug.outerHeight(true)]; });

    // position the pugs
    pugs.reduce(function(columnIndex, pug) {
      $pug = pug[0];
      height = pug[1];
      $pug.css('display', 'visible')
        .css('position', 'absolute')
        .css('top', columnHeights[columnIndex] + 'px')
        .css('left', (columnIndex * 340) + 'px');
      columnHeights[columnIndex] += height;
      return (columnIndex + 1) % length;
    }, 0);
  }

  function row() {
    var index, colIndex, length, $minCol, $currCol, $pug;

    for(index = 0, length = columns.length; index < length; index++) {

      // for(colIndex = 0; colIndex < length; colIndex++) {
      //   $currCol = $(columns[colIndex]);

      //   if(!$minCol) $minCol = $currCol;
      //   else $minCol = $minCol.height() > $currCol.height() ? $currCol : $minCol;
      // }

      $minCol = $(columns[index]);

      if(Pug.config.infinityOn) $minCol.data('listView').append(pug());
      else $minCol.append(pug());
    }
  }

  function pb(num) {
    var index;
    if(num <= 0) return;

    var start = Date.now();

    batch(num);
    // for(index = 0; index < num; index++) {
    //   row();
    // }

    $(window).height();

    var end = Date.now();
    console.log('time: ', end - start);


    if(!Pug.config.infinityOn) {
      $pug = columns.find('.pug');
      $pug.each(function() {
        $(this).attr('src', $(this).attr('data-original'));
      });
    }
  }

  Pug.bomb = pb;
  Pug.count = function() { return pugCount; };
}(window, document, jQuery, Pug);