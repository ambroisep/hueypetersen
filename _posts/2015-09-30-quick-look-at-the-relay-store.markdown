---
layout: post
title: Quick Look at the Relay Store
---

When Facebook announced GraphQL and Relay last spring I was instantly hooked.  They expressed and addressed many problems I've run into doing client side development.  To learn more I started working on a hacky implementation of GraphQL and while doing so accumulated a list of questions about Relay.  Most of the questions revolved around how Relay would store the data to enable all of the smart things it could do around minimal fetching and refetching.

Then I went on a [2,200 mile hike](http://athuey.com/) for five months.

Since then GraphQL and Relay have both been released and I am able to finally take a look at the Relay store.  This is just a quick look and there is more to learn, but I wanted to write this down so I would not forget.  If anyone else finds this useful it is purely by accident.

Flat
----

The first thing I noticed -- Relay has a lot of classes.  Even narrowing it down to things with `Store` leaves you many to choose from.  The class that actually holds our data ends up being `RelayStoreData` along with some help from `RelayRecordStore`.

A defining characteristic of GraphQL is that the query and the response have the same shape.  Relay doesn't store results in that shape though.  Instead it flattens the result into a key/value store.  For example given the following query and response:

<pre>
query {
  repository(id:40508605) {
    id
    name
    organization {
      id
      name
      location
    }
  }
}
</pre>

{% highlight javascript %}

{
  data: {
    repository: {
      id: 40508605,
      name: "relay",
      organization: {
        id: 69631,
        name: "Facebook"
        location: "Menlo Park, California"
      }
    }
  }
}

{% endhighlight %}

The store ends with the following flattened data representation:

{% highlight javascript %}

{
  records: {
    "40508605": {
      __dataID__: "40508605",
      id: 40508605,
      name: "relay",
      organization: {
        __dataID__: "69631"
      }
    },
    "69631": {
      __dataID__: "69631",
      id: 69631,
      name: "Facebook"
      location: "Menlo Park, California"
    }
  },
  rootCallMap: {
    repository: {
      "40508605": "40508605"
    }
  }
}

{% endhighlight %}

The global ids are used for the keys and `__dataID__` attribute.  To show relations between objects, such as _organization_ and _repository_, the value of the relation field is an object with the `__dataID__` of the relation.

Flattening the result gives a single source of truth for an object (via global id) no matter how many queries it is in and and what level of nesting it is within those queries.

This also enables Relay to query only minimal additions to an updated query.  When a query is going to be executed the full query is diffed not to some previous query but to the data store as a whole.  So again, no matter how the data got into the store, Relay knows how to compute the minimal query required.

One last piece is the `rootCallMap`.  This maps the root call's argument (e.g. `repository(id:40508605)` has a root call argument of `40508605`) to the global id of the resulting object.  In the above example the root call argument and the global id are the same so the mapping is a one-to-one.

Lets instead say the root call argument was `facebook/relay` -- the full name of the repository -- then the `rootCallMap` would look like:

{% highlight javascript %}

{
  rootCallMap: {
    repository: {
      "facebook/relay": "40508605"
    }
  }
}

{% endhighlight %}

This allows the flexibility to make the root call argument something other than the global id while still allowing relay to map between the root call and an object in the store.  So if another query comes along for `repository(name:facebook/relay) { name }` then Relay can map that to global id `40508605` and check if it already has the `name` for that object.

One downside to this flexibility is if we query the _organization_ root for id `69631` (e.g. `organization(id:69631)`) Relay can't assume the root call argument maps directly to the global id so a full query is sent even if we already have an object with the global id of `69631`.  Once that mapping is in place though subsequent queries will be able to intelligently diff with the store.

Non Nodes
---------

The two objects used in the above example -- _repository_ and _organization_ -- both satisfy the `Node` interface of having an `id`.  Not all objects are required to implement the node interface.  For example we could have an `updated` field on `repository` which maps to an object representation of a date time.  There is no reason for this to have an id.

<pre>
query {
  repository(id:40508605) {
    updated {
      month
      day
      year
    }
  }
}
</pre>

Instead Relay generates a global id to store this object.

{% highlight javascript %}

{
  records: {
    "40508605": {
      __dataID__: "40508605",
      updated: {
        __dataID__: "client:1903653301"
      }
    },
    "client:1903653301": {
      __dataID__: "client:1903653301",
      __path__: [RelayQueryPath],
      month: 8,
      day: 10,
      year: 2015
    }
  }
}

{% endhighlight %}

The `client:1903653301` id comes from Relay.

On the `updated` side we have an additional field: `__path__`.  This is an instance of `RelayQueryPath` and is used to get updates for `updated`.  If `repository` was updated Relay would be able to query the node directly since it implements the Node interface.  Since `updated` does not implement Node (no id) it needs to find the parent which *does* implement the Node interface.  `__path__` is able to facilitate this lookup.

Connections
-----------

Relays ability to smartly pagination through collections is one of its most impressive features.  This is the first thing  I wanted to figure out by looking at the store.  Specifically I wanted to see how cursors were used to compute new queries when `first` was updated.  Here is an example query.

<pre>
query {
  organization(id:69631) {
    repositories(first:1, startsWith: r) {
      edges {
        node {
          name
          fullName
        }
      }
    }
  }
}
</pre>

The `repositories` field ends up making three objects: the connection, the edge, and the node.  I'll cover each individually.

First up is the node.  This one is easy -- its just a normal looking object.

{% highlight javascript %}

{
  records: {
    "UmVwb3NpdG9yeToxOTg3MjQ1Ng==": {
      __dataID__: "UmVwb3NpdG9yeToxOTg3MjQ1Ng==",
      id: "UmVwb3NpdG9yeToxOTg3MjQ1Ng==",
      name: "relay",
      fullName: "facebook/relay"
    }
  }
}

{% endhighlight %}

The `__dataID__` is the global id for the repository (**FYI:** Relay adds the `id` to its queries on Nodes) and the rest of the fields are just data from the result.  Makes sense.

Next up is the edge.

{% highlight javascript %}

{
  records: {
    "client:client:-11714806802:UmVwb3NpdG9yeToxOTg3MjQ1Ng==": {
      __dataID__: "client:client:-11714806802:UmVwb3NpdG9yeToxOTg3MjQ1Ng==",
      __path__: ...,
      node: {
        __dataID__: "UmVwb3NpdG9yeToxOTg3MjQ1Ng=="
      },
      cursor: "YXJyYXljb25uZWN0aW9uOjA="
    }
  }
}

{% endhighlight %}

Each edge doesn't have a global id so Relay creates one.  This id ends up being a combination of the connection id (which we will get to but is `client:-11714806802`) and the id of the node (`UmVwb3NpdG9yeToxOTg3MjQ1Ng==`).

The only piece of data the edge contains is the cursor which was added to our query by Relay.

Finally, the connection itself.  The connection has a lot going on!  Each piece will be covered individually but here is the whole enchilada (you can totally skip this).

{% highlight javascript %}

{
  records: {
    "69631": {
      __dataID__: "69631",
      repositories.startsWith(r) {
        __dataID__: "client:-11714806802"
      }
    },
    "client:-11714806802": {
      __dataID__: "client:-11714806802",
      __path__: ...,
      __filterCalls__: [{
        name: "startsWith",
        value: "r"
      }],
      __forceIndex__: 0,
      __range__: {
        orderedSegments: [{
          indexToMetadataMap: {
            "0": {
              edgeID: "client:client:-11714806802:UmVwb3NpdG9yeToxOTg3MjQ1Ng==",
              cursor: "YXJyYXljb25uZWN0aW9uOjA=",
              deleted: false
            },
          },
          idToIndicesMap: {
            "client:client:-11714806802:UmVwb3NpdG9yeToxOTg3MjQ1Ng==": [0]
          },
          cursorToIndexMap: {
            YXJyYXljb25uZWN0aW9uOjA: 0
          },
          count: 1,
          minIndex: 0,
          maxIndex: 0
        }, {
          indexTMetadataMap: { },
          idToIndicesMap: { },
          cursorToIndexMap: { },
          count: 0,
          minIndex: null,
          maxIndex: null
        }],
        staticQueriesMap: { },
        hasFirst: true,
        hasLast: false
      }
    }
  }
}

{% endhighlight %}

The first piece is the relationship from organization to repositories.

{% highlight javascript %}

{
  records: {
    "69631": {
      __dataID__: "69631",
      repositories.startsWith(r) {
        __dataID__: "client:-11714806802"
      }
    }
  }
}

{% endhighlight %}

The thing to notice here is that the field name is `repositories.startsWith(r)`.  While the query includes `first: 1` this is not included in the field name.  The reason for this is that Relay ignores pagination arguments (`first`, `last`, `before`, `after`) for uniquely identifying a connection.  So if you query `repositories(first:5, startsWith:r)` and `repositories(last:5, startsWith:r)` the resulting nodes are all held within the same `repositories.startsWith(r)` connection.

Moving on to the connection the main thing of note is the `__range__` field.  This is an instance of `GraphQLRange` and holds all the magic.

{% highlight javascript %}

{
  records: {
    "client:-11714806802": {
      ...,
      __range__: {
        orderedSegments: [{
          indexToMetadataMap: {
            "0": {
              edgeID: "client:client:-11714806802:UmVwb3NpdG9yeToxOTg3MjQ1Ng==",
              cursor: "YXJyYXljb25uZWN0aW9uOjA=",
              deleted: false
            },
          },
          idToIndicesMap: {
            "client:client:-11714806802:UmVwb3NpdG9yeToxOTg3MjQ1Ng==": [0]
          },
          cursorToIndexMap: {
            YXJyYXljb25uZWN0aW9uOjA=: 0
          },
          count: 1,
          minIndex: 0,
          maxIndex: 0
        }, {
          indexTMetadataMap: { },
          idToIndicesMap: { },
          cursorToIndexMap: { },
          count: 0,
          minIndex: null,
          maxIndex: null
        }],
        staticQueriesMap: { },
        hasFirst: true,
        hasLast: false
      }
    }
  }
}

{% endhighlight %}

A `GraphQLRange` includes an array of `GraphQLSegments` -- the `orderedSegments` field.  These segments are collections for contiguous edges within a range.  For instance if you have `repositories(first:5)` there will be a segment holding those five results.  If you have another query for `repositories(last:5)` there will be a second segment holding those five results.

In the above example we have two segments with the first segment holding our single result from `repositories(first:1, startsWith:r)` and the second segment being empty (we have no `last` query so a single segment is sufficient).

Lets say that first argument was updated to 2: `repositories(first: 2, startsWith:r)`.  The range is able to look at that query, find the appropriate segment, and notice that we already have the first edge for that connection.  Given the cursor of that first edge the query can be updated to `repositories(first:1, after:YXJyYXljb25uZWN0aW9uOjA=, startsWith:r)`.

Relay is smart.

Lets say instead we have two queries: `repositories(first:1, startsWith:r)` and `repositories(last:1, startsWith:r)`.  In this case the range would have two segments each holding a single result.

{% highlight javascript %}

// some fields of range left out to avoid clutter

{
  records: {
    "client:-11714806802": {
      __range__: {
        orderedSegments: [{
          indexToMetadataMap: {
            "0": {
              edgeID: "client:client:-1619317112:UmVwb3NpdG9yeToxOTg3MjQ1Ng==",
              cursor: "YXJyYXljb25uZWN0aW9uOjA=",
              deleted: false
            },
          },
          count: 1,
          minIndex: 0,
          maxIndex: 0
        }, {
          indexTMetadataMap: {
            "0": {
              edgeID: "client:client:-1619317112:UmVwb3NpdG9yeToyMDk4MDUzMg==",
              cursor: "YXJyYXljb25uZWN0aW9uOjI=",
              deleted: false
            }
          },
          count: 1,
          minIndex: 0,
          maxIndex: 0
        }]
      }
    }
  }
}

{% endhighlight %}

If the query with first was updated to 2 -- `repositories(first:2, startsWith:r)` -- we'd end up with a slightly different result from the previous example with only a single segment.  This time since the range includes both a first and last segment it not only adds an `after` argument but also a `before` argument.  This is to avoid fetching the edge which is a part of our second segment.  So the updated query would be `repositories(first:1, after: YXJyYXljb25uZWN0aW9uOjA=, before: YXJyYXljb25uZWN0aW9uOjI=, startsWith:r)`.  We'll get at most one new edge and possibly zero if this connection is made up of only two results.

In the case where the two segments end up colliding -- cursors have met from both the first and last segments -- the segments can be collapsed into a single segment.

{% highlight javascript %}

{
  records: {
    "client:-11714806802": {
      __range__: {
        orderedSegments: [{
          indexToMetadataMap: {
            "0": {
              edgeID: "client:client:-1619317112:UmVwb3NpdG9yeToxOTg3MjQ1Ng==",
              cursor: "YXJyYXljb25uZWN0aW9uOjA=",
              deleted: false
            },
            "1": {
              edgeID: "client:client:-1619317112:UmVwb3NpdG9yeToyMDk4MDUzMg==",
              cursor: "YXJyYXljb25uZWN0aW9uOjI=",
              deleted: false
            }
          },
          count: 2,
          minIndex: 0,
          maxIndex: 1
        }]
      }
    }
  }
}

{% endhighlight %}

Any attempt to update `first` or `last` on the query will result in no network calls -- Relay knows it now has the entire contents of that connection.

I find this brilliant.

The one gotcha that I've run into is you can't specify `after` or `before` in your own fragments.  This throws the range for a loop because it is trying to look for the cursor in a segment but it is not guaranteed to be there.  If the cursor cannot be found you get an error.

Mutations
---------

Mutation is where I'm going to be a bit light on details -- I am still figuring it out.  I think this is pretty common for Relay -- mutations take awhile to wrap your head around.

Mutations do add a whole level to the store which I've so far ignored.  That records map from global ids to data -- there are actually three of them: `queuedRecords`, `records`, and `cachedRecords`.  We've only been looking at `records` but when a component requests a field on an object the first match found -- starting from `queuedRecords`, moving to `records`, and finally `cachedRecords` -- is used.  If you have a Todo object where in `queuedRecords` it is marked complete but in `records` it is not complete then the component is going to get the queued result -- complete.

This is done for optimistic mutations.  An optimistic mutation is going to immediately store a value in `queuedRecords` and every component watching that object is going to be updated to the queued / optimistic result.  The object in the queued store also gets marked with a mutation id.  When the mutation finally completes the record store is updated and the queued store value -- which was marked with the mutation id -- is deleted.

Here is an example using `ChangeTodoStatusMutation` from the Relay TodoMVC example.  This is used to mark a Todo complete.  When we send the query we include an optimistic result which gets stored in the queued records.

{% highlight javascript %}

{
  queuedRecords: {
    "VG9kbzox": {
      __mutationIDS__: ["0"],
      complete: true
    }    
  },
  records: {
    "VG9kbzox": {
      text: "Buy a unicorn",
      complete: false
    }
  }
}

{% endhighlight %}

Once the mutation successfully completes we update the record store and delete the optimistic result.

{% highlight javascript %}

{
  queuedRecords: {
  },
  records: {
    "VG9kbzox": {
      text: "Buy a unicorn",
      complete: true
    }
  }
}

{% endhighlight %}

This also makes rolling back optimistic updates possible -- I think at least, haven't tried!

As far as the cached store ... I have no idea.

Components and Fragments
------------------------

The last piece I want to touch on are how the Relay components use the store.  There are actually a lot of pieces to this (GraphQLQuery, RelayQuery, GraphQLFragmentPointer, GraphQLStoreQueryResolver, etc) that I'm going to skip.  The main idea though is that each component can subscribe to global ids that it cares about.  When a query writes to the store the store keeps track of which global ids were mutated.  Once the query result has fully been stored the mutated ids are checked against the subscriptions and the components get notified that their data has changed.

Conclusion
----------

The main takeaway I got from the Relay store is that global ids and the Node interface make much of the Relay magic possible.  When I had first been wondering how Relay was going to accomplish all that it set out to do I couldn't wrap my head around how it would know objects had the same identity across queries or within different levels of the same query.  It turns out global ids are useful for this!  Also turns out adding id to queries even when fragments don't need them is useful too.
