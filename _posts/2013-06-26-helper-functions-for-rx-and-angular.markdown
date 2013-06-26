---
layout: post
title: Helper Functions for Doing Rx in Angular
---

[RxJS](https://github.com/Reactive-Extensions/RxJS) is a javascript implementation of the [Reactive Extensions](http://msdn.microsoft.com/en-us/data/gg577609.aspx) for doing [Reactive Programming](http://en.wikipedia.org/wiki/Reactive_programming).  Reactive Programming reminds me of what it would be like if a future (promise) had a baby with enumerable.  Where as a future is a single asynchronous value an observable is many asynchronous values.

*NOTE: I learned futures from Scala / Akka before Javascripts so in my brain I always think future instead of promise.  In Akka, when I learned at least, the future was the read side (zero or more times) and the promise was the write side (at most once).  In Javascripts both sides are called promises.*

So far in my playing around RxJS has been working nicely with Angular.  There are three things I find myself doing when integrating the two:

- turning an Angular promise into an observable
- turning an Angular watch into an observable
- turning an Angular scope function call into an observable

Promises
---

Turning an Angular promise into an observable is pretty straight forward.

{% highlight javascript %}

var promiseToObservable = function(promise) {
    var observable = new Rx.AsyncSubject();

    promise.then(function(res) {
        observable.onNext(res);
        observable.onCompleted();
    }, function(err) {
        observable.onError(err);
    });

    return observable;
};

Rx.promiseToObservable = promiseToObservable

{% endhighlight %}

This is a pretty generic pattern for turning any promise into an observable -- on success callback call `onNext` and `onComplete` and on an error call `onError`.  I end up just attaching it to the `window.Rx` object.

Why would you want to do this?  The canonical example is a typeahead.  When the user searches for a term you perform an asynchronous web request which fetches the potential completions.  With a typeahead the user is constantly changing their search term which is triggering several asynchronous requests.  One potential problem is if they search for *"black"* and then *"black sab"* you have no control over which web request will finish last and you don't want to end up having the results for *"black sab"* overwrite the results for *"black"* by the requests finishing out of order.

Enter `switchLatest`.  This will take an observable of observables (mouthful) and switch so that only the latest observable sequence is returned.

{% highlight javascript %}

var artists = terms.sample(250)
    .select(function(term) {
        var promise = artists.query(term);
        return Rx.promiseToObservable(promise)
    })
    .switchLatest()
    .select(function(result) {
        return result.data.artists;
    });

{% endhighlight %}

The above code takes an observable of search terms, `terms`, samples it every 250ms, and performs an asynchronous query to look up the artists.  If the requests take more than 250ms we might get interleaving of the results which `switchLatest` will elminate -- we only see ordered responses.  Then we select (map) the result to a list of artists.  The end result is an observable of an array of artists which only contain the most recent results.

Watches
---

Angular watches are the observer pattern so pretty similar to an observable already.  The difference is that they lack the composability of observables.  As shown in the typeahead example above the composability is pretty nice.

{% highlight javascript %}

var watchToObservable = function(scope, expression) {

    var observable = new Rx.Subject();

    scope.$watch(expression, function(value) {
        observable.onNext(value);
    });

    return observable;
}

Rx.watchToObservable = watchToObservable

{% endhighlight %}

To create an observable from a watch we just need a scope and an expression.  We pass the expression directly to the watch call and then for the listener we call `onNext` on the observable.  Sticking with the typeahead example we could use this to produce the original sequence of terms.

{% highlight javascript %}

var terms = Rx.watchToObservable($scope, 'term');

{% endhighlight %}

This would produce the original observable stream of search terms from an `ng-model` set to `term`.

Functions
---

Sometimes you also want to turn function calls on the scope into an observable.  I use this one the least.  The only example I have is when you are using `ng-change` instead of `ng-model`.  I'm also not super happy with the syntax.  The code is nearly identical to the watch example.

{% highlight javascript %}

var functionToObservable = function(scope, name) {

    var observable = new Rx.Subject();

    scope[name] = function(value) {
        observable.onNext(value);
    };

    return observable;
}

Rx.functionToObservable = functionToObservable

{% endhighlight %}

Using the exact same search terms example but this time instead using `ng-change` set to `setTerm(term)` in the view.

{% highlight javascript %}

var terms = Rx.functionToObservable($scope, 'setTerm');

{% endhighlight %}

These are pretty short functions -- nothing too special.  Hope they help.  Vive la Angular et RxJS!