---
layout: post
title: Experimenting with GraphQL Subscriptions
---

Subscriptions were recently added to [graphql-js](https://github.com/graphql/graphql-js/pull/189) via [@skevy](https://twitter.com/skevy).  It is early times for subscriptions and things can change but there is enough there to experiment with the implementation.  So I did!

Code for the experiment is on [github](https://github.com/eyston/graphql-todo-subscriptions) as well as running on [heroku](https://secure-reef-2553.herokuapp.com/).

For a high level description of subscriptions refer to the official [GraphQL blog post](http://graphql.org/blog/subscriptions-in-graphql-and-relay/).  The general idea is there is a new operation type, `subscription`, which you can use like `query` and `mutation`.  Using the standard todo example a subscription might look like:

<pre>
subscription {
  addTodo {
    todo {
      id
      text
      complete
    }
  }
}
</pre>

And when a todo is added the client would receive the payload:

{% highlight javascript %}

{
  "data": {
    "addTodo": {
      "todo": {
        "id": 123,
        "text": "Try out GraphQL subscriptions",
        "complete": false
      }
    }
  }
}

{% endhighlight %}

At least that is how I interpret things!

Just a Promise
--------------

The `graphql-js` implementation currently returns a promise on execution.  This makes sense for a query and mutation -- they each produce a single response.  But what about subscriptions?  A subscription for `todoAdd` could have zero or more responses.

One way to accommodate subscriptions within `graphql-js` would be to change the return type to an observable (or something similar) which can return zero or more responses.  This would not be a minor change!  Instead the current subscription implementation still returns a promise.

This shifts the burden of how to return multiple responses from a subscription to something external of `graphql-js`.  This is accomplished by running the same subscription query multiple times.  An example!

The client subscribes to `todoAdd` with the following query:

<pre>
subscription($clientSubscriptionId: String) {
  addTodo(clientSubscriptionId: $clientSubscriptionId) {
    todo {
      id
      text
      complete
    }
  }
}
</pre>

The first query execution sets up the subscription.  The `clientSubscriptionId` is used by the client to identify the subscription.  The initial result of the query is pretty boring since no todo has been added yet.

{% highlight javascript %}

{
  "data": {
    "addTodo": {
      "todo": null
    }
  }
}

{% endhighlight %}

This completes the client request.  It is now up to the server to push new query results to the client.

A new todo is added ... by someone somewhere.  This raises an event!

{% highlight javascript %}

{
  "type": "TODO_ADD",
  "todoId": 123
}

{% endhighlight %}

The server then re-runs the subscription query in response to the event with the following result pushed to the client:

{% highlight javascript %}

{
  "data": {
    "addTodo": {
      "todo": {
        "id": 123,
        "text": "Try out GraphQL subscriptions",
        "complete": false        
      }
    }
  }
}

{% endhighlight %}

Voila!  This continues for each event until the client unsubscribes.

Pain Points
-----------

So thats how (I think) things should work.  I'm going to now go over my implementation along with the pain points I came across.  The goal of this is useful feedback -- one can dream.

Saving the Query
----------------

Since `graphql-js` continues to return a promise we need to run the query multiple times.  This means we need to save the query.  This seems easy enough but is slightly tricky since you only want to save subscription queries.  The information of what kind of operation is within a query is known by the client and is known by `graphql-js` once its parsed, but might not be known by many pieces in the middle.  For example `express-graphql` doesn't know or care if the operation is a subscription or not -- the query is just a string.

Also, the query is not the only information we need.  We also need the variables, operation name, and root value.  The variables and operation name can be saved along with the query but you probably don't want to save the root value.  It is totally legit to have the root value contain references to caches, databases, or what not.  Instead this means you need to make sure your root value is always generated in a consistent manner.  Previously this was easy -- you probably only generated it in one place!  But now queries are run in response to client requests and server events so the root value might be generated in more places.  Not a big deal, but this does insert opportunities to be inconsistent.

Finally the subscription has an identity: `clientSubscriptionId`.  This is useful for identity as well as idempotency (discussed later).  Without some kind of convention only the resolve function of a subscription can know the value of `clientSubscriptionId` for sure.  For example the following three queries all have the same `clientSubscriptionId` but I don't see how you'd know that anywhere other than the resolve function.

<pre>
subscription($clientSubscriptionId: String) {
  addTodo(clientSubscriptionId: $clientSubscriptionId) { todo { id } }
}

// variables: { clientSubscriptionId: 123 }
</pre>

<pre>
subscription {
  addTodo(clientSubscriptionId: 123) { todo { id } }
}

// variables: { }
</pre>

<pre>
subscription($foo: String) {
  addTodo(clientSubscriptionId: $foo) { todo { id } }
}

// variables: { foo: 123 }
</pre>

This lead me to the situation where I handle saving the subscription query inside the resolve function itself.

Multiple Contexts for Resolve
-----------------------------

A subscription resolve function ends up being run in (at least?) two contexts.

- a clients request to create the subscription
- a server event to trigger a push to the client

The same resolve handles both of these.  This means the resolve has to make sure it only creates the subscription once.  The `clientSubscriptionId` is useful in this regard.  The resolve function can check if the client has an existing subscription with a matching `clientSubscriptionId` and either create the subscription or not.

In the case of a server event the event payload somehow needs to be included with the query.  I did this by including the event -- if one exists -- in the root value.  This leads to the situation where the root value now differs between contexts -- which might be weird.  The resolve function needs to be able to handle not having an event since the initial request to create a subscription most likely won't have one.

The resolve function has to also potentially handle an event meant for a different subscription.  For example take the following query:

<pre>
subscription {
  addTodo(clientSubscriptionId: 1) { todo { id } }
  deleteTodo(clientSubscriptionId: 2) { deletedTodoId }
}
</pre>

This query can be run in the context of no event, an add todo event, a delete todo event, or maybe both!  The same type of event could even be in the same query twice:

<pre>
subscription {
  addTodoId: addTodo(clientSubscriptionId: 1) { todo { id } }
  addTodoText: addTodo(clientSubscriptionId: 2) { todo { text } }
}
</pre>

This ended up leading to more conditionals in my resolve functions.  It also meant I needed two ways to execute a query: one with an event payload, and one without an event payload.

No Event Responses
------------------

Continuing with the `addTodo` example -- there are going to be query responses with no event.  So what does the response look like?  I made the response `null` for the subscription.

{% highlight javascript %}

{
  "data": {
    "addTodo": {
      "todo": null
    }
  }
}

{% endhighlight %}

I'm not sure if this is good or bad.  Maybe the subscription could just not return until it gets an event, but even in that case there are going to be situations where the subscription resolve needs to render a non-event.  For example a query with two subscription fields:

<pre>
subscription {
  addTodo(clientSubscriptionId: 1) { todo { id } }
  deleteTodo(clientSubscriptionId: 2) { deletedTodoId }
}
</pre>

When this query executes in response to a todo being deleted it won't have an event for add todo.

{% highlight javascript %}

{
  "data": {
    "addTodo": {
      "todo": null
    },
    "deleteTodo": {
      "deletedTodoId": 123
    }
  }
}

{% endhighlight %}

Not really sure if this is good or bad -- the client just needs to know how to handle it.  Or maybe a UNION type for non-results?  I don't know!

Side Channel
------------

Since `graphql-js` doesn't return an observable you need to create a side channel for additional results to get pushed to.  I happen to like that it isn't an observable (yet at least) but still -- this is more work to coordinate at the moment.

Client Store
------------

Since Relay doesn't handle subscriptions yet I made a dumb little store for my todo app.  One issue I ran into is that when I added a todo it got added twice: once by the mutation handler and once by the subscription handler.  This is 100% the fault of my code, but is just something to keep in mind: a client is going to get two responses for mutations it is responsible for!

Good Parts
----------

Enough pain!

I like that the initial implementation isn't prescriptive.  I think eventually something will emerge -- especially once Relay sets some conventions -- but for now everything you need to build your own subscription layer is there.

For example my toy app is all in memory but I tried to simulate it being distributed and communicating via queues by using `EventEmitter`.  A client creates a queue for results to be pushed to and these results could potentially be pushed from any number of different servers.  The initial request is processed by graphql server A, the next event by graphql server B, etc.

This is also encouraged by the implementation needing to explicitly save the state to run the query multiple times.  A callback or observable might capture that state implicitly instead.

While the basis is having an event based subscription system there isn't anything saying you can't roll up several events into a single subscription.  For example my todo app has the `deleteTodo`, `addTodo`, and `changeTodoStatus` subscriptions.  These each listen to a single event.  But there is also the `todos` subscription.  This listens to all three of the other events and allows a client to subscribe to the list as a whole.

And if you want an observable you can make one no problem.

Finally, it is also very fun to enter a todo on one browser and see it in another ... but I am impressed easily.

Summary
-------

I think most of the pain is my not knowing what the conventions should be.  With the current state of `graphql-js` you can do whatever you want!  This is great, except I don't know what I want yet :).  I think Relay will help drive a lot of this as well.  While you might be able to do things a ton of different ways it makes sense to make the Relay way an easy path.

And big thanks to @skevy!
