---
layout: post
title: Building a Typeahead Directive with AngularJS
---

I am building a little project that lets the user keep a list of artists and albums and I needed a typeahead / autocomplete that would match on such things.  I took inspiration from the last.fm typeahead:

![lastfm typeahead](/images/2013-06/lastfm-typeahead.png)

I am also using the [last.fm api](http://www.last.fm/api).

My first thought was to wrap the Twitter Bootstrap typeahead in Angular.  The problem is I wanted full control over the html in the typeahead.  For instance I wanted little sidebars that said 'artists' and 'albums'.  I had no idea how to do this with the Bootstrap typeahead.  Another problem is from a purely aesthetic point of view I don't like wrapping things in Angular if the problem itself is easily solved using Angular.

I thought this would be a good project to tackle with Angular so I wrote my own.

The starting point was to create a custom component.  Angular lets you define your own html elements and so the `typeahead` element was born!

{% highlight html %}

<typeahead />

{% endhighlight %}

It doesn't do much yet.

Transclusion
---

Many typeaheads let you control the html of individual result items by passing a string of html to render.  That isn't very Angular.  It also doesn't fully get me what I want since I need those 'artist' and 'album' sidebars which aren't part of any single element.  What I really want is an Angular template with all of the normal directives at my disposal.  Then I want this html shoved into the typeahead control which can control the typeahead-y things like when its visible, selecting items, and what not.

So Angular has this idea of transclusion, which sounds quite fancy.  And it is!  Transclusion lets you use the html content of your custom component within the componenet template itself.  This means I can have full control over the html of the typeahead while letting the shared behavior live within the typeahead component.

As an example, if I define my html as such:

{% highlight html %}

<typeahead>
    <ul ng-repeat="artist in artists">
        <li>{{ "{{artist.name" }}}}</li>
    </ul>
</typeahead>

{% endhighlight %}

And then the template of the `typeahead` component is this:

{% highlight html %}

<div>
    <form>
        <input type="text" autocomplete="off" />
    </form>
    <div ng-transclude></div>
</div>

{% endhighlight %}

The final result with a list of artists would be:

{% highlight html %}

<div>
    <form>
        <input type="text" autocomplete="off" />
    </form>
    <div ng-transclude>
        <ul ng-repeat="artist in artists">
            <li>Black Eyed Peas</li>
            <li>Black Sabbath</li>
            <li>The Black Keys</li>
        </ul>
    </div>
</div>

{% endhighlight %}

This is exactly what I want.  I'm able to use the full power of Angular to create my list and the component takes care of the rest.  The key thing to note is the `ng-transclude` tag within the `typeahead` template.  This is where the inner html from the component will be shoved... er, transcluded.

You also have to configure the componenet directive to use transclusion.

{% highlight javascript %}

angular.module('ymusica').directive('typeahead', ["$timeout", function($timeout) {
    return {
        restrict: 'E',
        transclude: true,
        replace: true,
        template: '...',

        // ...
    };
}]);

{% endhighlight %}

Directive Controllers
---

At this point I have the html I'm after, but unfortunately it doesn't do anything.  I need the html and the `typeahead` component to talk to each other so that when the user types something the proper item in the list is highlighted, or if the user clicks on an item in the list it is selected.

![lastfm highlighted](/images/2013-06/lastfm-highlighted.png)

When the user types `black` the first item in the list is highlighted (Black Eyed Peas).  They then press `down` and the second item in the list is highlighted  (Black Sabbath) and the first one loses highlight.  This is the behavior you would expect out of a typeahead.

The issue is that the `typeahead` component places no constraints on the structure of the rendered list so it has no idea which item model corresponds to which html element.  We need a way to link the items in the list together so that they can communicate on which one needs to be highlighted.

One way to accomplish this is with a directive controller.  The typeahead component (which is a directive in case that isn't clear) can declare a controller which other directives can request access to.  This controller allows communication between the directives -- namely which item is currently highlighted.

The directive responsible for each typeahead item is called `typeahead-item` (yeah, I'm great at names), which is placed on each selectable item within the list like so:

{% highlight html %}

<typeahead>
    <ul ng-repeat="artist in artists">
        <li typeahead-item="artist">{{ "{{artist.name" }}}}</li>
    </ul>
</typeahead>

{% endhighlight %}

The `typeahead-item` directive links a given model (the artist) to the corresponding html (the `li` element).  The `typeahead` component keeps track of which item is currently highlighted and the `typeahead-item` directives watch this value with a comparison on their own item and act accordingly.  In my case the action is just adding or removing a class.

Heres the code:

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

The directive requires the `typeahead` controller.  The `^` in `require: '^typeahead'` instructs Angular to look on parent elements until it finds the controller.

The model item that is assigned to the directive (`typeahead-item="artist"`) is captured as a local variable.  A watch is created on whether the item is `active`, which means `highlighted` (I apparently lack consistent naming), and sets a class accordingly.  This class could be made configurable pretty easily but its fine for now.

There are then two event listeners which communicate back to the controller when the item is clicked on (select it) or hovered over (activate / highlight it).

The end result is that the component is able to highlight and select items attached to any arbitrary html elements.  Success!  The actual `typeahead` component contains a bunch of code in its linker / controller but its pretty basic typeahead stuff and agnostic to how the list is rendered.

I love that customizing the look of the typeahed list consists of writing the same type of Angular code I use to customize how anything looks.  I don't have to learn the magic configuration language of a plugin.  Win.

Here is the final template with all the nitty-gritty of the `typeahead` component wired up.

{% highlight html %}

<typeahead class="typeahead" items="music" term="term" search="searchMusic(term)" select="selectMusic(item)">
    <div class="menu" ng-cloak>
        <h3 ng-show="hasAlbums()">Albums</h3>
        <ul>
            <li typeahead-item="album" ng-repeat="album in albums" class="results">
                <img ng-src="{{ "{{imageSource(album)" }}}}"><p class="name">{{ "{{album.name" }}}}</p><p class="artist">{{ "{{album.artist" }}}}</p>
            </li>
        </ul>
        <h3 ng-show="hasArtists()">Artists</h3>
        <ul>
            <li typeahead-item="artist" ng-repeat="artist in artists" class="results">
                <img ng-src="{{ "{{imageSource(artist)" }}}}"><p class="name">{{ "{{artist.name" }}}}</p>
            </li>
        </ul>
    </div>
</typeahead>

{% endhighlight %}

*[Gist](https://gist.github.com/eyston/5851760) of the code.*

And with results:

![angular typeahead](/images/2013-06/angular-typeahead.png)

Its like the last.fm one but uglier.  Mission accomplished.