---
layout: post
title: Building a Typeahead Directive with AngularJS
---

I wanted a typeahead for a personal project I was working on.  Previously I've used jQuery plugins or most recently the Twitter Bootstrap typeahead.  These work for simple cases but as soon as you want to customize the styling you have to dig into the guts of how they work.  At that point I just gave up and decided I wanted to create my own.

A nice side benefit of this is that I wouldn't be wrapping something in an Angular but instead implementing it in Angular.  This pleases my nerd aesthetics.

It also ended up being a good exploration of many facets of directives.  It was made much easier by the great videos -- go watch them.

Components
---

Angular hsa the concept of a component which lets you define your own reusable html elements.  So I want my typeahead to be one of these.  You should be able to use it multiple times all over your application.  Here is what I want the implementation to look like:

{% highlight html %}

<typeahead class="typeahead" items="music" term="term" search="searchMusic(term)" select="selectMusic(item)">
    <div class="menu" ng-cloak>
        <h3 ng-show="hasAlbums()">Albums</h3>
        <ul>
            <li typeahead-item="album" ng-repeat="album in albums" class="results">
                <img ng-src="{{imageSource(album)}}"><p class="name">{{album.name}}</p><p class="artist">{{album.artist}}</p>
            </li>
        </ul>
        <h3 ng-show="hasArtists()">Artists</h3>
        <ul>
            <li typeahead-item="artist" ng-repeat="artist in artists" class="results">
                <img ng-src="{{imageSource(artist)}}"><p class="name">{{artist.name}}</p>
            </li>
        </ul>
    </div>
</typeahead>

{% endhighlight %}

So there is a lot going on here.  Let me run through the key concepts.

Transclusion
---

The inner html of the typeahead element is the template that will be rendered when the typeahead is active.  The nice thing about this is I have the full power of html and Angular at my disposal.  I don't have to learn the configuration language of a plugin.  I like this.

This is called transclusion.  I'm able to take the inner html and shove it anywhere inside the template of my directive.  I'm not sure why its called transclusion, as that is a scary word, but its pretty cool.  In order to do this I have to configure my directive to enable transclude and include an `ng-transclude` tag in my directive template.

{% highlight javascript %}

angular.module('ymusica').directive('typeahead', ["$timeout", function($timeout) {
    return {
        restrict: 'E',
        transclude: true,
        replace: true,
        template:
            '<div>' +
                '<form>' +
                    '<input ng-model="term" ng-change="query()" type="text" autocomplete="off" />' +
                '</form>' +
                '<div ng-transclude></div>' +
            '</div>',

        // ...
    };
}]);

{% endhighlight %}

The key parts are the `transclude: true` and the `ng-transclude` on the final `div`.  I've also restricted this directive to elements and set `replace: true` to replace the `typeahead` element with the rendered template (a `div`).

The transcluded html is also kinda fancy for my limited design skiils.  I was stealing lastfm's design poorly.  It looks like this:

Show Image Here LOLZ

There is a sub list of albums and artists.  This would probably be a pain with most typeaheads where here its pretty straight forward.  Again, its great to stay in the language of html and Angular the whole way through.

Scope
---

Scope is the magic sauce of directives.  Again, the videos make it much easier to learn.  Watch them!

Since I want this compomenent to be reusable I am using an isolate scope.  This way the scope is segregated from the controller scope and I won't worry about any pollution between the two.  This does mean I have to define a contract / interface between the two scopes.  I've designed it as such:

{% highlight javascript %}

scope: {
    search: "&", // void function(term)
    select: "&", // void function(item)

    items: "=", // array of itmes
    term: "="   // search term as string
}

{% endhighlight %}

This interface ended up being a bit bigger than I wanted, but I think it makes sense.  There are two functions and two data items.

First we have a list of items that the user can select from which is called `items`.  This needs to be ordered in the sense that if you have the first index highlighted and you press `down` you would expect the second index to be highlighted.  Then we have `term` which is the search term being displayed in the user input of the typeahead.  This can both be updated by the user typing and by the controller.

For the functions we have `search` which gets called when the user alters the input of the typeahead.  It is called with a single argument being the term the user has entered.  This function is where any web service call or lookup would be performed which could then alter the `items` array.

One important note is that this function is only called when the user alters `term`, not when the controller does.  This is accomplished by using `ng-change` on the input instead of only `ng-model`.  The reason to do this is when a user selects an item it is pretty common to update the `term` text and you don't want that resulting in a new lookup being performed.

`select` is called when the user clicks on an item in the `typeahead` or arrows to an item and hits `enter` or `tab`.  This function has a single argument of the item selected.  It is then up to the controller on what it wants to do on select.  In my toy case I just update the search term with the selected item and log it to the console.

{% highlight javascript %}

$scope.selectMusic = function(item) {
    console.log('music selected!', item);
    $scope.term = item.name;
};

{% endhighlight %}

This ends up being a good split of responsibilities between the controller and typeahead componenent.  The controller does the lookup, provides the list of selectable items, and reacts to the user selecting one.  Everything else is abstracted away inside the component.  Groovy.

Controller
---

So we're using transclusion, custom html elements, and isolate scope -- whats left?  How about the directive having a controller!  One side effect of using transclusion for the rendering of the typeahead list is that the typeahead directive has no idea what html in the list signifies an item in the list.  This is important because when the user presses 'up' or 'down' we have to highlight the appropriate selection.  We also need to react to `mouseenter` and `click` events on the item.  We can enable this communication between the items and the typeahead using a directive controller.

I have a second directive called `typeahead-item` that is put on the element in the transcluded html.

{% highlight html %}

<li typeahead-item="album" ng-repeat="album in albums" class="results">
    <img ng-src="{{imageSource(album)}}"><p class="name">{{album.name}}</p><p class="artist">{{album.artist}}</p>
</li>

{% endhighlight %}

This directive takes an item that can be compared with equality to the `items` list on the typeahead directive.  Now when a user selects a new `item` from the `items` list we can find the appropriate child directive of `typeahead-item` and let it know that its selected (and the previously selected one is unselected).

This communication is done via a controller.  The `typeahead` directive has a controller which includes the function `isActive(item)`.  The `typeahead-item` directives require this controller and then watch for the value of `isActive(item)` to change bewteen `true` and `false`.

{% highlight javascript %}

angular.module('ymusica').directive('typeaheadItem', function() {
    return {
        require: '^typeahead',
        link: function(scope, element, attrs, controller) {

            var item = scope.$eval(attrs.typeaheadItem);

            scope.$watch(function() { return controller.isActive(item); }, function(active) {
                if (active) {
                    element.addClass('active');
                } else {
                    element.removeClass('active');
                }
            });

            element.bind('mouseenter', function(e) {
                scope.$apply(function() { controller.activate(item); });
            });

            element.bind('click', function(e) {
                scope.$apply(function() { controller.select(item); });
            });
        }
    };
});

{% endhighlight %}

We require the controller using `^typeahead` which tells the directive to look at the parents for a controller from a `typeahead` directive.  The controller is then passed into the linking function.  We set up our watch on `controller.isActive(item)` as well as bind a few dom events.  When the `mouseenter` event is fired we want to activate the item and when the user `clicks` on the item we want to select it.

So controllers on directives allow a way to communicate.  Here we have a parent / child type relationship between `typeahead` and `typeahead-items`.

I'm also very good at making up names (`typeahead-items` ... really?).