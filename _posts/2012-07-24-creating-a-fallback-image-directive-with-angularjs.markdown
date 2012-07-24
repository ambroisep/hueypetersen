---
layout: post
title: Creating a Fallback Image Directive with AngularJS
summary: In an effort to learn AngularJS I'm implementing features in a current Javascript Backbone application using AngularJS.  This AngularJS directive takes a list of image URL's and tries each one in succession taking the first success and sets it to the images src tag.
---

AngularJS is a Javascript UI framework I've been playing with lately.  The key strength of AngularJS is its declarative nature.  You can define how you want your model to be represented in the UI and the framework takes care of ensuring the DOM is always up to date.  This is done via dirty checking your model, which has been attached to a scope (something AngularJS controls).  This is in contrast to other Javascript UI frameworks which require that your model inherit from a framework base model and then you subscribe to events, of which I'm not a fan (inheritance or events).

The dirty checking is perhaps inelegant and a potential performance concern but the benefits are attractive enough that I can get over this nagging until it is proven to be an actual, not imaginary, problem.

The other aesthetic to get used to is having your HTML littered with AngularJS directives.  Again, learn to deal with it.

Fallback Images
----

So I have a current application which loads a thumbnail image for an asset.  This thumbnail image may not exist and if it does not we fallback to loading the full image.  This same thing could be applied to retina caliber thumbnails -- we try to load a retina thumbnail first, then a non-retina thumbnail, then the full image.

We can boil it down to: **provided a list of image urls the first one that loads is used**.

Here is what we want the HTML to look like:

{% highlight html %}
<body ng-app="DemoApp" ng-controller="DemoController">
  <img fallback-images="images" />
</body>
{% endhighlight %}

The `ng-app="DemoApp"` wires up the AngularJS application and the `ng-controller="DemoController"` wires up the controller.  The `fallback-images` is the directive we are going to write.  It is assigned a model property on the `DemoController`, in this case `images`.

For more information on the `ng-app` and `ng-controller` directives check the AngularJS tutorials (they are useful).

Writing Directives
---

Directives are responsible for wiring up the DOM and your model.  This two way binding is what makes AngularJS attractive and many useful directives are included out of the box.  For cases that are not covered the answer is to write your own directive.  Most jQuery you would normally be writing is now a directive.

For this directive we need a controller and a linking function.

Controller
---

The controller is where your view model type code lives.  It should be DOM ignorant.  The controller model will end up having a plain javascript object (POJO) that represents the view.  This is nice for development and testing.

For our case the view model is pretty simple -- the current image url to use.  In order to compute this we have an array of urls to try and an array of urls that have failed.  Both of these arrays are just javascript arrays.

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

The `image` function returns the image we should be using (or undefined if there is no image left to try).  Given an array of images (defined as `$scope.fallbackImages` and set by the parent controller) and an array of bad images (the previously discussed `$scope.badImages`) the image function will always return the image we want to use.  This is easy to reason about and test, and could be broken out to a pure function that the `$scope` calls supplying the parameters.

Linking
---

The linking function is the function that gets run once the DOM element the directive has been attached to is loaded.  So in the case above the `fallback-images` linking function will be run once the `img` tag is loaded.  This is the perfect time to wire up event listeners to both the DOM and to the model.

We care about a few events.  We care when the image to load has been changed.  We care when we load an image successfully and we care when we fail to load an image.  This covers our bases.

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

The first event we listen for is the value of the `image` function to change.  This is the function defined in the controller that always returns the image to load.  We are able to listen for a change via the AngularJS `$watch` functionality.  When AngularJS does dirty checking and finds this function return value has changed (it is dirty) our supplied callback function is run.  It is given the old and new value which is awesome.  In more complicated scenarios this lets you find what was added, what was updated, and what was removed (enter / update / exit in D3.js vernacular).

When the image changes and it is not undefined we set the `src` attribute of our hidden image element to try and load this image.  We use a hidden element instead of the main element purely for aesthetic reasons -- we avoid showing error image icons and the image is able to be swapped in fully loaded.

The next event we care about is if the hidden element has an error loading the image.  In this case we want to add the attempted url to the `badImages` array on the scope and do so by calling `imageFailed` defined by our controller.  We wrap this in an `$apply` in order to alert AngularJS that this function will require a dirty check afterwards.  This is in contrast to raising an event.

The key here is that the image failing event is not responsible for trying to load the next image.  The watch we defined earlier will take care of that for us.  No matter how the `image` function return gets changed the watch will be fired.  In this case it would be due to mutating the `badImages` array but it also happens when the `fallbackImages` array is mutated from the parent controller.  You can't avoid having the watch do its thing.  I prefer this to defining my own named events -- there is less as a developer you have to keep in your head and remember to do (*"which events do I care about again?"*).

The last event is if the image loads successfully.  This one is simple -- we take the successful image url and set it to the visible image source.  Done.

Parent Controller
---

We want this directive to be capable of being applied to many image elements.  Each element can have its own list of images to try.  The parent controller of the `fallback-image` directive is responsible for setting this list of images.  In the HTML when we set `fallback-image="images"` we are setting the `images` array, which lives in the parent controller, as this list.

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

This defines the images to try.  We then configure the directive to bind itself to this value.

{% highlight javascript %}

scope: {
  fallbackImages: '='
}

{% endhighlight %}

The `=` configures the `fallbackImages` value on the directives scope to be bound to the parent scope's specified property, which in this case is `images`.  If the directive mutates `fallbackScope` then the `images` array will reflect this and vice-versa.  Watches will also be fired.

With this we can have a parent controller responsible for many image elements each having their own array of fallback images to try.