---
layout: post
title: RelayCompositeNetworkLayer for Querying Local Data
---

Today I released an [npm package](https://www.npmjs.com/package/relay-composite-network-layer) for creating a [Relay Network Layer](https://facebook.github.io/relay/docs/guides-network-layer.html) built from multiple schemas.  What this allows you to do is have a *server* schema and a *local* schema presented to Relay as a single *composite* schema.  Queries are able to be written querying data from both schemas seamlessly.

At least thats the hope.

The code can be found on [github](https://github.com/eyston/relay-composite-network-layer) along with an explanation of use.  It handles what little I've thrown at it but it is not in use in production anywhere (I don't have a production anywhere to put it).  If it is useful to you that would be awesome and I'd happily try and fix any issues but be ready for bugs.

What I'd like to do now is explore how the network layer works.

Merging
-------

Relay doesn't work with multiple schemas.  It wants one schema.  So we give it one.

This one schema is generated from merging multiple schemas.  During this merging process each field is marked with what schema it originates from.  For example given a `User` object we might have two schemas:

<pre>
# server
type User : Node {
  id: ID!
  name: String
}

# local
type User : Node {
  id: ID!
  browsingDuration: Int
}
</pre>

This will produce the merged type along with a map of field to schema:

<pre>
# composite
type User : Node {
  id: ID!
  name: String
  browsingDuration: Int
}
</pre>

{% highlight javascript %}

{
  User: {
    name: 'server',
    browsingDuration: 'local'
  }
}

{% endhighlight %}

Right now merging types are limited to implementors of the `Node` interface so the `id` field can be satisfied by every schema and thus no mapping is required.

Thats pretty much it for merging!

Splitting
---------

Relay works with the single merged schema like normal.  It generates queries and sends them to the network layer.  It is then the network layers job to split them up and send them to the appropriate backend.

This splitting is done by traversing the query AST and looking up fields and their schema.  This AST is actually a Relay internal object and not the raw GraphQL AST.  This is because the GraphQL AST is not enough to execute a query (it needs variable values) as well as Relay doing some magic to the query itself (alias'ing fields automatically for example).  The downside to this is the library is making use of undocumented Relay internals.

Oops!

To demonstrate the splitting process we'll look at a query for a user and their drafts.

<pre>
query {
  viewer {
    name                 # server field
    age                  # server field
    draftCount           # local field
    drafts(first: 10) {  # local field
      edges {
        nodes {
          text
          author {
            name         # server field
          }
        }
      }
    }    
  }
}
</pre>

In this query the root of the query AST is the `viewer` field on the Query type.  During the merging process the Query type also has its fields mapped to schemas.  In this case we have a mapping of `viewer` to `server`.

{% highlight javascript %}

{
  queryType: 'Query',
  Query: {
    viewer: 'server'
  }
}

{% endhighlight %}

This sets the current context of the traversal to `server`.  Each child of the `viewer` field is now traversed and grouped by schema.  So given the above query we have two groups: `server` and `local`.

{% highlight javascript %}

const groups = {
  server: ['name', 'age'],
  local: ['draftCount', 'drafts']
}

{% endhighlight %}

Since the current field's schema is `server` we can take the fields which are also `server` and include them in the current query.

<pre>
query {
  viewer {
    name
    age
  }
}
</pre>

The fields for `local` on the other hand belong to a different schema.  This means we need to create a new query to handle these fields.  The first step is to create a fragment which holds all these fields.

<pre>
fragment on User {
  draftCount
  drafts(first: 10) {
    edges {
      nodes {
        text
        author {
          name
        }
      }
    }
  }      
}
</pre>

The next step is to turn that fragment into a proper root query.  These queries always have the same shape:

<pre>
query {
  node(id: $id) {
    ...fragment
  }
}
</pre>

Since only objects implementing the `Node` interface can be extended we can always start off with a `node` query as the root.  The fragment is then put into this template and we get the following query:

<pre>
query {
  node(id: $id) {
    ... on User {
      drafts(first: 10) {
        edges {
          nodes {
            text
            author {
              name
            }
          }
        }
      }      
    }
  }
}
</pre>

This query has a dependency on an `id` of the node.  This `id` is supplied from the result of the first query: `viewer.id`.  This means the two queries must be run sequentially.  The first query is sent to the server which returns the viewer id, name, and age.  The id from this result is then supplied to the second query which is sent to the local schema and executed.

The second query isn't quite right though -- the `author { name }` field is from the server but this query is local.  Not a problem though -- we can just split this query like the initial query.  This is done recursively down the entire query AST.

The end result is we have three queries:

<pre>
# server
query {
  viewer {
    name
    age
  }
}
</pre>

<pre>
# local : viewer.id => id
query {
  node(id: $id) {
    fragment on User {
      drafts(first: 10) {
        edges {
          nodes {
            text
            author {
              id
            }
          }
        }
      }      
    }
  }
}
</pre>

<pre>
# server : author.id => id
query {
  node(id: $id) {
    fragment on User {
      name
    }
  }
}
</pre>

These queries are run sequentially as each has a dependency on the previous.

Execution
---------

The actual execution of each query is handed off to a separate Relay Network Layer per schema.  This means they can all be local, all servers, a mix, or anything else that implements the `RelayNetworkLayer` interface.  The only job left is to merge the results.  So again, given the above query, we end up with multiple responses.

{% highlight javascript %}

// server
{
  data: {
    viewer: {
      id: 1,
      name: 'Huey',
      age: 13
    }
  }
}

// local: viewer.id => id
{
  data: {
    node: {
      id: 1,
      draftCount: 2,
      drafts: {
        edges: [{
          node: {
            text: 'Taste javascript',
            author: {
              id: 1
            }
          }
        }, {
          node: {
            text: 'Paint a self portrait',
            author: {
              id: 1
            }
          }
        }]
      }
    }
  }
}

// server: node.drafts.edges[0].node.author.id => id
{
  data: {
    node: {
      id: 1,
      name: 'Huey'
    }
  }
}

// server: node.drafts.edges[1].node.author.id => id
{
  data: {
    node: {
      id: 1,
      name: 'Huey'
    }
  }
}

{% endhighlight %}

These can then all be merged together.

{% highlight javascript %}

{
  data: {
    viewer: {
      id: 1,
      name: 'Huey',
      age: 13
      draftCount: 2,
      drafts: {
        edges: [{
          node: {
            text: 'Taste javascript',
            author: {
              id: 1,
              name: 'Huey'
            }
          }
        },{
          node: {
            text: 'Paint a self portrait',
            author: {
              id: 1,
              name: 'Huey'
            }
          }
        }]
      }
    }
  }
}

{% endhighlight %}

One thing to notice is that multiple queries are sent to the node with the `viewer.id`.  Each user is the author of its own drafts.  Unfortunately the network layer is at a layer beyond the `Relay.Store` cache.  This means the generated queries -- the ones dependent on the original root query -- do not go through the cache layer to be satisfied locally if possible.  This means you can easily shoot yourself in the root with an N+1 query situation as you go back and forth between schemas.

What Next?
----------

Like most things I do this was an experiment.  It worked out.  I'm pretty happy with the code although describing the algorithm here I've already thought of a way to make it simpler (I think).

Again, I'm interested in feedback if anyone finds this useful but without a production app to try it in I can't say it is ready for anything other than tinkering!

Ultimately this can be accomplished by Relay core better.  The information about which schema a field belongs to can be verbose for large schemas (even though its only recorded for `Node` implementors).  It can probably be optimized by having a *default* schema but the best solution is having `Relay.QL` include the schema at parse time.

The issue with non-cached results is an even bigger detriment with doing this at the network layer versus Relay core.  Ideally each dependent query would be able to check the cache first before making a network request.

Another feature would be being able to extend non-`Node` implementors as long as they have a `Node` parent.  This would be pretty easy -- we'd just need to track a path back to the parent which is a `Node`.

That said, the next thing I'm going to work on is making it easy to create local schemas.  If all of your data is in memory there are a lot of assumptions which can be made.  You could get down to defining a fully working schema by using the GraphQL IDL.

<pre>

type User {
  id: ID!
  name: String
  drafts: [Draft]
}

type Draft {
  id: ID!
  text: String
  author: User
}

</pre>

This definition could be used to create a flat store -- much like Relay internals -- and all the GraphQL resolve functions required to read it.  Taking it a step further you could generate CRUD-based mutations for all defined types.  Not something you'd want to do for a backend, but if your store is just an in-memory object graph that you want to be able to interact with quickly it makes sense.

I really like GraphQL.
