---
layout: post
title: Creating a Fallback Image Directive with AngularJS
summary: In an effort to learn AngularJS I'm implementing features in a current Javascript Backbone application using AngularJS.  Here I create a directive that allows an image tag to be supplied a list of urls to try.
---

AngularJS is a Javascript UI framework I've been playing with lately.  The key strength of AngularJS is its declarative nature.  You can define how you want your model to be represented in the UI and the framework takes care of ensuring the DOM is always up to date.  This is done via dirty checking your model.  This is in contrast to other Javascript UI frameworks which require that your model inherit from a framework base model and then you subscribe to events, of which I'm not a fan (inheritance or events).

The dirty checking is perhaps inelegant and a potential performance concern but the benefits are attractive enough that I can get over this nagging until it is proven to be an actual, not imaginary, problem.

The other aesthetic to get used to is having your HTML littered with AngularJS directives.  Again, learn to deal with it.

This post assumes you have some familiarity with AngularJS and glosses over a few details.  If that is not the case there are solid video tutorials on the [AngularJS site](http://angularjs.org/).

Fallback Images
----

I have an application which loads a thumbnail image for an asset.  This thumbnail image may not exist and if it does not we fallback to loading the full image.  This could be expanded with retina caliber thumbnails -- we try to load a retina thumbnail first, then a non-retina thumbnail, then the full image.

We can boil it down to: **provided a list of image urls the first one that loads is used**.

Here is what we want the HTML to look like:

{% highlight html %}
<body ng-controller="DemoController">
  <img fallback-images="images" />
</body>
{% endhighlight %}

The `fallback-images` attribute is the directive we are going to write.

Writing Directives
---

Directives are responsible for wiring up the DOM and your model.  This two way binding is what makes AngularJS attractive and many useful directives are included out of the box.  For cases that are not covered the answer is to write your own directive.  Most jQuery you would normally write is now a directive.

For this directive we need a controller and a linking function.

Controller
---

The controller is where your view model code lives.  It should be DOM ignorant.  The controller model will end up having plain javascript objects (POJOs) that represents the view.  This is nice for development and testing.

For our case the view model is pretty simple -- the image url to use.  In order to compute this we have an array of urls to try and an array of urls that have failed.  Both of these arrays are just javascript arrays.

Here is the controller:

{% highlight javascript %}

controller: function($scope) {

  $scope.badImages = [];

  $scope.imageFailed = function(image) {
    $scope.badImages.push(image);
  };

  $scope.image = function() {
    var potentialNextImages = $scope.fallbackImages.filter(function(image) {
      return $scope.badImages.indexOf(image) === -1;
    });

    if(potentialNextImages.length > 0) {
      return potentialNextImages[0];
    }
  };
}

{% endhighlight %}

We initialize `badImages` to an empty array and whenever we call `imageFailed` we add the image to the `badImages` array.  Easy enough.

The `image` function returns the image url to use (or undefined if there is no image).  For example if the image array is `['image1.jpg', 'image2.jpg', 'image3.jpg']` and the failed images are `['image1.jpg']` then the function returns `'image2.jpg'`.

*Note: This function could be broken out as a pure function which the `$scope` function calls supplying parameters.  For such a small bit of logic I'm cool having it inside the controller.  Plus this is still very testable, just not 'pure'.*

Linking
---

The linking function is where you hide much of your DOM specific code.  It is executed once the DOM element is ready which is the perfect time to wire up event listeners to both the DOM and the model.

We care about a few events: when the image to load is updated, when an image is loaded successfully, and when an image fails to load.

Here is the linking function which wires up those three events:

{% highlight javascript %}

link: function(scope, element, attrs) {

  var loadElement = angular.element(document.createElement('img'));

  scope.$watch('image()', function(newImage, oldImage) {
    if(newImage) {
      loadElement.attr('src', newImage);
    }
  });

  loadElement.bind('error', function() {
    scope.$apply(function() { scope.imageFailed(loadElement.attr('src')); });
  });

  loadElement.bind('load', function() {
    element.attr('src', loadElement.attr('src'));
  });

}

{% endhighlight %}

First we create a DOM element to load the images.  We create a new element instead of using the existing element purely for aesthetic reasons -- we avoid showing missing image icons and the image is able to be swapped in fully loaded.

The first event we listen for is the value of the `image` function to change.  Since this function is attached to the scope we can use a `$watch`.  The `$watch` function takes an expression to watch and a callback.  The callback is executed whenever the value of the expression changes.  The callback for this watch updates the image source to the new image url.

*Note: The callback has the old and new values as parameters which is awesome. In more complicated scenarios this lets you find what was added, what was updated, and what was removed (enter / update / exit in D3.js vernacular).*

The next event we care about is if the image has an error loading.  When this happens we add the url to the list of failed images.  We wrap this in an `$apply` in order to alert AngularJS that this function will require a dirty check afterwards.  This is in contrast to raising an event in other frameworks.

The key here is that the image failing event is not responsible for trying to load the next image.  The watch we defined earlier will take care of that for us.  No matter how the value of the `image` function is updated the watch will be fired.  In this case it would be due to mutating the `badImages` array but it also happens when the `fallbackImages` array is mutated from the parent controller.

I prefer this to defining my own named events -- there is less as a developer you have to keep in your head and remember to do (*"which events do I care about again?"*).

The last event is if the image loads successfully.  This one is simple -- we take the successful image url and set it to the visible image source.  Done.

Parent Controller
---

The last bit is setting the list of images to try and load.  We do this by binding a property from the parent scope to the directive scope.

Here is the parent controller:

{% highlight javascript %}

function DemoController($scope) {
  $scope.images = [
    "images/image1_thumbnail@2x.jpg",
    "images/image1_thumbnail.jpg",
    "images/image1.jpg"
  ];
}

{% endhighlight %}

This defines the images to try.  We then configure the directive to bind itself to the specified property:

{% highlight javascript %}

scope: {
  fallbackImages: '='
}

{% endhighlight %}

Finally we link the two in the HTML:

{% highlight html %}
<img fallback-images="images" />
{% endhighlight %}

The result of this is that the `fallbackImages` property of the directive scope is bound to the `images` property of the parent controller scope.  A change to one is a change to both.

Closing
---

So this was my first directive.  There is plenty more to learn such as compiling and pre-linking, but this was a useful exercise to understand linking and directive scopes.

I've created a [jsfiddle](http://jsfiddle.net/eyston/URrbN/) with it all put together.

Feedback welcome!