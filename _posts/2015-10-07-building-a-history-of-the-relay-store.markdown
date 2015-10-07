---
layout: post
title: Building a History of the Relay Store
---

I [previously](/posts/2015/09/30/quick-look-at-the-relay-store/) looked at the implementation of the Relay Store.  Most of this was gleaned from looking at the source code for Relay and setting `debugger` statements all over the code to dig deeper with the Chrome Developer Tools.  Later on I decided I wanted to visualize the store and made a little inspector.

![inspector](/images/2015-10/inspector.png)

The inspector shows a list of changes to the store due to queries and mutations.  Each change can be inspected showing the query and the raw view of the store with highlighted diffs.

My React code for this is pretty horrible, but I figured I'd at least share the small bit of code needed to hook into the Relay Store in case someone was inclined to build something useful.

Here be the [gist](https://gist.github.com/eyston/b456814978f6672f02d2).

Handlers
--------

Looking at the `RelayStoreData` class there are two methods (at least...) used to mutate the store: `handleQueryPayload` and `handleUpdatePayload`.  These are called with the response from `query` and `mutate` requests.

{% highlight javascript %}

RelayStoreData.prototype.handleQueryPayload = function handleQueryPayload(query, response, forceIndex) {
  // ...
};

RelayStoreData.prototype.handleUpdatePayload = function handleUpdatePayload(operation, payload, ref) {
  // ...
};

{% endhighlight %}

I monkey patch these two methods in order to subscribe to changes to the store as a whole.  Whenever they are finished executing a snapshot of the store is taken.  Another nice benefit of these two handlers is that they include both the query and payload which lead to the store mutation.  These two bits of information are also recorded.

I use [immutable.js](https://facebook.github.io/immutable-js/) for the copy of the store as it handles value equality semantics for me (useful in determining whats different in each change).

The end result is that we have a history as a list of changes to the Relay Store.  Each change includes the state of the store as an immutable copy as well as the query and response which define that change.
