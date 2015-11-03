---
layout: post
title: Experimenting with GraphQL Subscriptions
---

Subscriptions were recently added to [graphql-js](https://github.com/graphql/graphql-js/pull/189) via [@skevy](https://twitter.com/skevy).  It is early times for subscriptions and things can change but there is enough implementation there to experiment with.  So I did!

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

And when a todo is added the client would get pushed the subscription:

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

The first query execution sets up whatever is required to react to events.  In this example lets assume there is a `TODO_ADD` event within our application that this subscription can listen for.  On the initial subscription execution a mechanism is setup to listen for the `TODO_ADD` event and we return a response to the client.

{% highlight javascript %}

{
  "data": {
    "addTodo": {
      "todo": null
    }
  }
}

{% endhighlight %}

The response is sort of weird.  There was no `TODO_ADD` event on the initial query execution -- we hadn't even started listening for one yet -- so instead a `null` payload is returned.

It is now up to the server to push new query results to the client.

When a new todo is added -- by someone somewhere -- a `TODO_ADD` event is raised!

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

Voila!  This continues for each event until the client unsubscribes.  The unsubscribe process happens completely outside of `graphql-js`.

So Many Options
---------------

The rest of this post is going to discuss choices I faced while implementing subscriptions in a toy application (yup, todos!).  Originally I had wanted to try and expose pain points to provide feedback for the implementation but it turns out most of the pain points are not due to any limitations but instead due to there being many ways to do the same thing.  This is not a bad thing but I lack any long term experience to know if some are better than others.

So instead of providing useful feedback I end up requesting feedback :).

Saving the Query
----------------

Since `graphql-js` continues to return a promise we need to run the query multiple times.  This means we need to save the query.  This seems easy enough but is slightly tricky since you only want to save subscription queries.  The information of what kind of operation is within a query is known by the client and is known by `graphql-js` once its parsed, but might not be known by many pieces in the middle.  For example `express-graphql` doesn't know or care if the operation is a subscription or not -- the query is just a string.

Also, the query is not the only information we need.  We also need the variables, operation name, and root value.  The variables and operation name can be saved along with the query but you probably don't want to save the root value.  It is totally legit to have the root value contain references to caches, databases, or what not.  Instead this means you need to make sure your root value is always generated in a consistent manner.  Previously this was easy -- you probably only generated it in one place!  But now queries are run in response to client requests and server events so the root value might be generated in more places.  Not a big deal, but this does insert opportunities to be inconsistent.

The choice I had was:

- save the subscription query within the resolve functions
- pass information from the client on what type of operation a query is and save it before executing subscription queries

I ended up trying both.  My first run saved the query inside each subscriptions resolve function.  The benefits of this is that the query string can remain opaque all the way through your middleware.  The downside is that the resolve function becomes responsible for pulling the query and context from _somewhere_ to be saved.  I passed it as part of the root value but I believe the third argument to the resolve function also contains this information.

My second attempt used observables (I wanted to try those out) and saved the query before executing `graphql-js`.  This meant the type of query (e.g. subscription) was passed along from client to server.

I'm not sure which of these I prefer.  Which one is better probably comes down to the question of how to handle multiple subscription fields.

Multiple Subscription Fields
----------------------------

Even through `graphql-js` doesn't have the notion of a subscription as a concrete thing with identity -- it is just a query string -- your implementation probably will.  For example I had a subscription model which included the query information (saved above) along with any other information required to run the query in response to an event and unsubscribe the query in response to the client.

This raises the question of how to handle multiple fields on a subscription query.

<pre>
subscription {
  addTodo {
    todo {
      id
      text
      complete
    }
  }
  deleteTodo {
    deletedTodoId
  }
}
</pre>

Are `addTodo` and `deleteTodo` two separate subscriptions meaning they can be unsubscribed from independently?  Or are they grouped together as one logical subscription?  Both seem reasonable.

If they are grouped together then saving the query inside the resolve function becomes weird -- you have two resolve functions which know nothing about each other which both need to save themselves to the same subscription.  Instead if the subscription is saved before the resolve functions run then an identifier for the subscription can be created that each resolve function groups itself under.

I tried both of these.  Again, I'm not sure which I prefer.  I started off not wanting to know what type of operation a query string was which meant I did it all in the resolve function resulting in one subscription per field in the query.  But in the end I found I needed to differentiate operation types for other reasons so saving it before resolve was also doable.

Multiple Contexts for Resolve
-----------------------------

Subscriptions require running the same query multiple times in different contexts.  The two contexts being:

- a client subscribes to events
- the server responds to events

The resolve functions for a subscription field end up needing to know this.  I initially made the distinction between states implicit but ended up making it explicit with a `subscription mode` root value: `INITIALIZE` and `EVENT`.  I think implicit is fine but was trying a bunch of different implementations so what implicitly defined `INITIALIZE` vs `EVENT` kept changing.  Plus being explicit is always nice if not a bit heavy handed :).

Executing the query in response to a client subscription request would generally not have any event data associated with it.  For example if a user subscribes to `addTodo` there is no `TODO_ADD` event payload at the time of subscription.  Same query but multiple contexts.

When an event did happen it would be placed in the root value for the query execution.  This required having two places a root value is generated -- one in response to a client without an event and another in response to a server event with that event.

At the end of the day my resolve functions had two duties.  On `INITIALIZE` they would do whatever is required to start listening to server events.  On `EVENT` they would use the root value event payload to resolve themselves.

The final wrinkle was again handling multiple fields on the same subscription.

<pre>
subscription {
  addTodo {
    todo {
      id
      text
      complete
    }
  }
  deleteTodo {
    deletedTodoId
  }
}
</pre>

When this query is executed in response to a server event it might be a `TODO_ADD` event or `TODO_DELETE` event.  The resolve function for `addTodo` needs to ignore `TODO_DELETE` events.  The server events in my implementation had a `type` field which the resolve function could be conditional on.

{% highlight javascript %}

{
  "type": "TODO_ADD",
  "todoId": 123
}

{% endhighlight %}

That said if you have two subscription fields, both for `addTodo` but one aliased, and a `TODO_ADD` event is triggered on the server I'm not sure what behavior would be expected.  My implementation would end up triggering twice -- once for each field -- but both fields would have a payload in each triggering.  What can you do!

Empty Subscription Responses
----------------------------

When there is no event on a subscription execution -- what do you respond with?  I just responded with `null`.  I don't know if that is good or bad or what else you could even do!  It is just sort of weird and you need to make sure the client can handle `null` and there is shared knowledge on what `null` means.

I had thought about not responding unless there *is* an event.  But, again, multiple fields forced me to deal with this.

<pre>
subscription {
  addTodo {
    todo {
      id
      text
      complete
    }
  }
  deleteTodo {
    deletedTodoId
  }
}
</pre>

It is totally valid to execute this query with a `TODO_DELETE` event and not a `TODO_ADD` event.  This means `addTodo` has to have *some* value for no event.  Maybe a union value would be better than `null`?

Side Channel
------------

Since `graphql-js` doesn't return an observable you need to create a side channel for additional results to get pushed to.  I happen to like that it isn't an observable (yet at least) but still -- this is more work to coordinate at the moment.

I used `socket-io` as a way to push to the client and `EventEmitter` as a substitution for some kind of topic server to listen for new results.  But that is far from a requirement.  Your client could instead poll HTTP and check a database of stored subscription results.  The world is your oyster!

Client Store
------------

Since Relay doesn't handle subscriptions yet I made a dumb little store for my todo app.  One issue I ran into is that when I added a todo it got added twice: once by the mutation handler and once by the subscription handler.  This is 100% the fault of my code, but is just something to keep in mind: a client is going to get two responses for mutations it is responsible for!

Summary
-------

I like that the initial implementation isn't prescriptive.  I think eventually something will emerge -- especially once Relay sets some conventions -- but for now everything you need to build your own subscription layer is there.

For example my toy app is all in memory but I tried to simulate it being distributed and communicating via pub-sub by using `EventEmitter`.  Each client has a topic it subscribes to for results which can then be published from any number of servers handling events and executing subscription queries.

This was helped by the implementation needing to explicitly save the state to run the query multiple times.  A callback or observable might capture that state implicitly instead which could make you local to one machine.

While the basis is having an event based subscription system there isn't anything saying you can't roll up several events into a single subscription.  For example my todo app has the `deleteTodo`, `addTodo`, and `changeTodoStatus` subscriptions.  These each listen to a single event.  But there is also the [`todos`](https://github.com/eyston/graphql-todo-subscriptions/blob/1af44410b83272f8a2834957b86c22e05625196d/data/schema.js#L200-L204) subscription which listens to all three of the other events and allows a client to subscribe to the list as a whole (sorta live query'ish).

And if you want an observable you can make one no problem.  I toyed with that in this [branch](https://github.com/eyston/graphql-todo-subscriptions/tree/observables) [here](https://github.com/eyston/graphql-todo-subscriptions/blob/observables/server/socket.js#L92-L114).

Finally, it is also very fun to enter a todo on one browser and see it in another ... but I am impressed easily.
