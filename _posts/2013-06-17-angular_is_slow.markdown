---
layout: post
title: Angular Is Slow
---

There was a recent [post](http://eviltrout.com/2013/06/15/ember-vs-angular.html) comparing AngularJS to EmberJS and one of the take aways was that AngularJS is fundamentally slower.  I'd like to address that.  This has nothing to do with AngularJS vs EmberJS as I think that is a boring discussion and I know nothing about EmberJS.

Models in AngularJS
---

One of the great selling points of AngularJS is that the model is just a plain javascript object.  In EmberJS you inherit from a common model base class.  This means your presentation layer runs all the way to your application layer.  As evidenced in the previously linked post it is possible to view this as a good thing.  Different strokes for different folks.

Not to spend too much time on this but the reason I enjoy them being separate is that it lets your models be more than something that lives in the database or is the result of a web request.  It is similar to Rails where it is common to have the mindset that a model is something that inherits from ActiveRecord or must live in a database.  I take model to represents anything that is separate from your presentation layer.  When you write MVC server side code you want your controller to make a single call to a method on a model and handle routing to a view.  This model could be a domain model tied to the database, a domain model which is purely conceptual, or a stateless service which coordinates between several models.  So model is a pretty vague term.  It is your application, not the presentation.

Angular lets you have classes, plain javascript objects, and even just single functions act as "models" with its factories.  Not all code needs to be tied to a web service or view.  I like this.

So a bit of a tangent there, but an important one I think.

Dirty Checking
---

Since your models are just plain javascript objects (POJO's) AngularJS keeps the view model (`$scope`) and the view in sync via dirty checking.  Ah, I missed a concept there.  Your model is not your view model.  It can be for simple cases, but as soon as you start feeling friction you want to let the view model evolve instead of changing your domain models to suit the view.

Anyways, this dirty checking consists of running equality checks over all of the data that the view depends on.  It is brute force and lacks  elegance.  This is where the accusation of 'slow' is being leveled at AngularJS.

The first thing about this dirty checking is to realize it is done via watches and watches are made up of two things: watch expressions and listeners.  Watch expressions are run every time data could be changed.  A watch expression can range from referencing a field to the execution of a function.  Watch expressions get run on every change and consequently should be fast and idempotent.  Listeners get run once when their watch expression changes.  Listeners do not have the same constraints as watch expressions.

A common watch expression that can get you in trouble is having an `ng-repeat` reference a function.

{% highlight html %}

    <ul>
        <li ng-repeat="order in filteredOrders()">
            {{ "{{order.number" }}}} :: {{ "{{order.status" }}}}
        </li>
    </ul>

{% endhighlight %}

The watch expression here is `filteredOrders()`.  This is a function which potentially is doing a lot of computation.  This is a way you can shoot yourself in the foot.  So yes, AngularJS lets you shoot yourself in the foot.

The way you get around this is realizing that your view model and model do not have to be the same.  The model, which may be a `customer` instance with an `orders` list can still be your single source of truth.  It is just that the `orders` list isn't what your view model is showing -- your view model is showing a subset of the orders.  The view only cares when this subset changes.

{% highlight javascript %}

    $scope.$watch("orderStatus", function(status) {
        $scope.filteredOrders = _($scope.customer.orders).filter(function(o) {
            return o.status === status;
        });
    });

{% endhighlight %}

Here `orderStatus` is a value on the `$scope` that the view can update (think checkbox, dropdown, toggle, etc).  When this changes we want to update the list.  Describing this as a cache seems wrong because there is nothing here you have to worry about keeping in sync.

If the model itself can be updated via web service calls in the background then add a watch to that too.

I think dirty checking is a wash.  It is a hack that lets you get away with using POJOs.  Being able to use POJOs is worth the cost for me.

Rendering
---

Of course the speed of dirty checking versus event raising on model changes is nothing compared with, you know, rendering the model to the screen.  This is where AngularJS can have a real advantage.

__Caveat:  I know how Handlebars works, but don't know how EmberJS works with Handlebars.  I could be wrong here!__

With many frameworks the process of rendering the view when a model changes consists of turning the model into a string of html and resetting the innerHtml of a dom element.  When the model changes again you repeat the same process every time.

AngularJS is different here as it is a [two step process](http://docs.angularjs.org/guide/compiler).  At some point a string has to be turned into html, even if that string is served from a server on the initial request.  AngularJS doesn't change that.  What it does change is that once that html has been constructed it isn't reconstructed on a model change.  Instead the dom is compiled looking for directives to link the dom to the model.  Now when the model changes the linkers make specific modifications to the dom.  It is not a rewrite the world change but a surgical one instead.

Think of it like this.

{% highlight javascript %}

    var linkAge = function($el) {
        return function(value) {
            $el.html(value);
        }
    }

    var $el = $('#age'),
        updateAge = linkAge($el);

    updateAge(13);
    updateAge(31);
    updateAge(42);

{% endhighlight %}

This is a bastardized version of a linker.  The important part is that we run the selector once, never destroy the element, and instead interact with its content directly.

This is fast.  This can be significantly faster than rendering an entire view over and over again on every model change.

So calling AngularJS slow due to dirty checking is missing the bigger picture.

Of course the speed difference between JS frameworks is pretty meaningless in most cases.  I wouldn't worry about it.