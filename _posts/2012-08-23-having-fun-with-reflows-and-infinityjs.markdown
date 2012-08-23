---
layout: post
title: Having Fun with Reflows and Infinity.js
summary: Using new found skills of the chrome web inspector we take a look at how infinity.js is causing reflows and seeing if it can be optimized for better performance.
---

[Infinity.js](http://airbnb.github.com/infinity/) is a javascript library written by [Airbnb](https://www.airbnb.com/) which allows for smooth scrolling for infinite (and finite) lists.  It accomplishes this by removing elements from the DOM if they are off the screen.  The project page includes a [demo](http://airbnb.github.com/infinity/demo-on.html) which loads 1200 items, made up of pug images, into a three column Pinterest-esque layout with both Infinity.js on and [off](http://airbnb.github.com/infinity/demo-off.html).  The load time is noticeably faster with Infinity.js on and I want to figure out why.

In case you haven't yet, look at the [demo](http://airbnb.github.com/infinity/demo-on.html).

__Big warning__ -- I'm not sure the load time is important.  The main point of this library is to improve scrolling performance.  The initial load may be inconsequential.  I am just scratching an itch here.

Reflows
---

There is an amazingly wonderful post titled [Modern Web Development](http://jtaby.com/2012/04/23/modern-web-development-part-1.html) by [Majd Taby](https://twitter.com/jtaby).  He goes over using the Chrome Development Tools and many other useful tid-bits for anyone doing web development.  One of the sections discusses the [timeline](http://jtaby.com/2012/04/23/modern-web-development-part-1.html#The%20Timeline%20Panel%20) which introduced me to the concept of [reflows](http://jtaby.com/2012/04/23/modern-web-development-part-1.html#Layout%20) (also called layout).

The quick definition of a reflow is when the browser has to calculate the position and dimensions of elements on the page.  On a dynamic page your javascript could cause the browser to have to update these calculations constantly.  The browser is smart and tries to buffer many individual changes into a single reflow but we can foil that by making a change and instantly asking for the result of the change.  Paul Irish has a great [video](http://paulirish.com/2011/dom-html5-css3-performance/) discussing this better than I could ever imagine to.

The main thing to know is that you want to limit how many times a browser has to do a reflow.  Doing 100 reflows is slower than doing one even if the same amount of work is being done (computers, who knew?).

Timeline
---

When I load the demo with Infinity.js on I get the following timeline.

![original timeline](/images/2012-08/timeline-original.png)

All of the purple is made up of *'Recalculate Style'* and *'Layout'* which I just refer to as reflows (there is a distinction -- a layout can happen without a calculate style ... I think!).  This is showing a single item added to the Infinite.js ListView.  We do 3 pairs of *'Recalculate Style'* and *'Layout'* for all 1200 items we add to the list.  I think the blue *'Parse'* stuff is the template being parsed from a string to HTML but don't hold me to that.

So the goal here is to try and reduce the number of reflows and see if it improves performance.  We can use the timeline provided stack trace for each reflow.

![stack trace](/images/2012-08/stack-trace.png)

There we go!  Ignoring jQuery stuff we see that this reflow is being caused by `updateCoords`.

{% highlight javascript %}

function updateCoords(listItem, yOffset) {
  var $el = listItem.$el;

  listItem.top = yOffset;
  listItem.height = $el.outerHeight(true);
  listItem.bottom = listItem.top + listItem.height;
  listItem.width = $el.width();
}

{% endhighlight %}

When we ask the browser for the elements height with `$el.outerHeight(true)` it causes a reflow because the element was just added to the DOM and the height had not previously been calculated.  Asking for the width with `$el.width()` does not cause a reflow because the DOM is in the same state as it was when we asked for the height.

So this sucks because we need the height and width of the element so I'm not sure how to optimize this away.  The long answer would be to batch the adding of elements and then calculate their height and width all at once.  That is too big of a change for me though so on to the next reflow.

The stack trace points to `Page.hasVacancy` as the source of the next reflow.

{% highlight javascript %}

Page.prototype.hasVacancy = function() {
  return this.height < $window.height() * config.PAGE_TO_SCREEN_RATIO;
};

{% endhighlight %}

Boom, `$window.height()` is the cause of this one.  This time we have an easy fix!  The window height isn't something that changes very often.  In fact I think you can just watch the `resize` event and cache the latest height value.  Lets go with that.

{% highlight javascript %}

var windowHeight = $(window).height();

$(window).bind('resize', function() {
  windowHeight = $(window).height();
})

Page.prototype.hasVacancy = function() {
  return this.height < windowHeight * config.PAGE_TO_SCREEN_RATIO;
};

{% endhighlight %}

Simple change.

Now lets see if it makes a difference for the performance.  We can find out by timing how long it takes the `Pug.bomb` method to add the 1200 pugs.  Out of the box this function uses `setTimeout` to add 70 pugs at a time to each column.  This lets the browser render the page in chunks instead of all 1200 at once.  It also makes it harder to benchmark, so I'm going to remove the `setTimeout` and just make it add all in a single go.

We end up with this.

{% highlight javascript %}

function pb(num) {
  var index;
  if(num <= 0) return;

  var start = Date.now();

  for(index = 0; index < num; index++) {
    row();
  }

  var end = Date.now();
  console.log('time: ', end - start);

  // snip ...
}

Pug.bomb = pb;

{% endhighlight %}

On my machine (tm) it takes ~4400ms without any changes.  After the change to `hasVacancy` we get ... drumroll ... ~4400ms.  Damn.  I checked the timeline and indeed we got rid of a reflow but it makes no difference.

The last reflow is not being caused by Infinity.js but instead by the demo scripts `render.js` function `row()`.  This function adds a pug to each column.

{% highlight javascript %}

function row() {
  var index, colIndex, length, $minCol, $currCol, $pug;

  for(index = 0, length = columns.length; index < length; index++) {

    for(colIndex = 0; colIndex < length; colIndex++) {
      $currCol = $(columns[colIndex]);

      if(!$minCol) $minCol = $currCol;
      else $minCol = $minCol.height() > $currCol.height() ? $currCol : $minCol;
    }

    if(Pug.config.infinityOn) $minCol.data('listView').append(pug());
    else $minCol.append(pug);
  }
}

{% endhighlight %}

The culprit is calculating the height of each column.  This is done in order to balance the columns -- the shortest column always gets the pug added.  Lets just comment that out and add to each column round robin.

The new time is ... ~3100ms.  Yay!  We made a difference.  This is a 30% boost.  If we need the behavior of balancing between the columns we could modify `ListView.append(pug)` to return the height of the `ListItem` added.  I'll leave that as an exercise for the reader (I'm lazy).

Reality Check
---

Okay, so the performance gain was made not inside of Infinity.js but the demo code.  Hmm... how fast was the non-Infinity.js demo?  If we turn Infinity.js off and revert the changes we get over 18000ms!  Now lets keep Infinity.js off but do the round robin adding of pugs instead of checking for the minimum height column.  Its now 5600ms.  Better than before but still not good and worse than Infinity.js.

Looking at the line `else $minCol.append(pug)` ... we are appending the pug function.  I have no idea what jQuery's behavior is for appending a function.  Instead I'll execute and append the result (either a string or an HTML element, not sure).

The time is now 650ms!  Okay, but this is cheating -- we aren't doing any reflows now.  If I add a `$(window).height()` after all the pugs are added to force the reflow I get ~2600ms.  Still it is interesting that simply removing the checking of column heights can drop the time from 18000ms to 2600ms.

Pinterest
---

My (p)interest was now piqued and I went over to the Pinterest site to see if I could glean anything from their timeline.  I didn't notice the same timeline characteristics as we are getting here.  There isn't a bunch of small reflows for each item.  But it is also clear that Pinterest knows the height of each element in order to perform their layout.  Each item is absolutely positioned with a top offset which can only be done if you know the elements height.

Well one idea is to add every element and then get their heights all at once.  This type of batching is the general technique for eliminating reflows.  In order to make the calculating of each elements height as simple as possible we make them absolutely positioned.  And to stop my machine from killing itself we set the elements hidden so they don't get painted on top of each other (hint: this was learned from experience).  Once that is done we can position them absolutely similar to how Pinterest does.

Here is the code!

{% highlight javascript %}

function batch(num) {
  var index = 0, length = columns.length, $column = $(columns[0]), 
    pugs = [], columnHeights = [0, 0, 0];

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

{% endhighlight %}

The function `batch` has replaced calling `row` 400 times.  This is still doing round robin positioning between columns but instead we could pick the shortest column like the original demo with no performance penalty (unfortunately, I'm lazy).  With this we get the time down to ~1300ms.  Again, this is with Infinity.js off.  So we've gone from 18000ms to 1300ms by minimizing reflows and making the remaining reflows cheaper.  Not too shabby.

Here is the [demo](/fiddles/infinity/) with Infinity.js off and here is the final timeline.

![final timeline](/images/2012-08/timeline-final.png)

We've gathered up those thousands of reflows down into a big honkin reflow.  Not shown is the fact that parsing the templates is taking up a huge chunk of time.  I'm curious what something like [Handlebars.js](http://handlebarsjs.com/) would do here.

The Point
---

So I'm not sure the point of this.  Infinity.js is meant to make things scroll smoother.  I didn't even try to compare scrolling speed!  I happily wandered off down my own path.

One point could be that Infinity.js doesn't preclude you from having to think about your own codes performance.  We saw here that the way the demo code was written actually had a large impact on performance.  Also, the best way to do minimize the initial load is to batch the adding of elements but how you batch might be too application specific -- Infinity.js may not be able to make that decision for you.  It does seem though that adding an element one at a time is currently limiting for Infinity.js as there is no way to get around a reflow caused by calculating the items dimensions.

The initial demo application does batch the adding of elements outside of Infinity.js -- it adds 70 rows at a time and lets the browser paint the first batch before adding the next batch.  This is smart as it speeds up the perceived loading time for the user.  Neato.

Of course this is all based on adding 1200 pugs to a page all at once.  YMMV.