---
layout: post
title: Querying GraphQL with Falcor
---

[GraphQL](http://graphql.org/) is a data query language released by Facebook and used by their client applications to request data.  It is awesome.  [Falcor](http://netflix.github.io/falcor/) is a data query language released by Netflix and used by their client applications to request data.  It is also awesome.  Lets put them together!

A quick primer.  I'm going to use two models from Github: Repository and Organization.  An Organization has many Repositories and a Repository can belong to an Organization.  A GraphQL query to get some data on a repository and its organization would look like:

{% highlight javascript %}

var query = `query {
  repository(id: "facebook/react") {
    name
    description
    organization {
      name
      description
    }
  }
}`;

{% endhighlight %}

And the same query in Falcor would look like:

{% highlight javascript %}

var query = [
  ['repositoryById', 'facebook/react', ['name', 'description']],
  ['repositoryById', 'facebook/react', 'organization', ['name', 'description']]
];

{% endhighlight %}

If you squint, they are the same.  GraphQL uses a string which contains a graph-looking-almost-json-thing while Falcor uses an array of paths with each path having a syntax akin to navigating a local javascript object (e.g. `repositoryById['facebook/react'].description`).

One nice thing about Falcor is that the datasource interface is very simple.  It has three methods: `get`, `set`, and `call`.  In this post I'm only going to examine the `get` call which is used to request data.  For example to execute the Falcor query defined above I'd run the following:

{% highlight javascript %}

var model = new falcor.Model({ source: new SomeRandomDataSource() });

model.get(query).then(graph => {
  console.log(graph); // all my data!
  assertDeepEqual({
    "json": {
      "repositoryById": {
        "facebook/react": {
          "name": "react",
          "description": "A declarative, efficient, and flexible JavaScript library for building user interfaces.",
          "organization": {
            "name": "Facebook",
            "description": "We work hard to contribute our work back to the web, mobile, big data, & infrastructure communities. NB: members must have two-factor auth."
          }
        }
      }
    }
  }, graph);
  // keep up the hard work Facebook, and don't forget that two-facor auth!
});

{% endhighlight %}

`get` is called with an array of paths and returns an observable of JsonGraph.  In short JsonGraph is a way to represent a graph (which can be cyclic) as a tree (which is acyclic) in json.

Since a Falcor Model can use any DataSource that implements the interface and the interface is so small I decided to take a stab at writing a DataSource which would query a GraphQL backend.  Normally you'd use a Falcor Router, but where's the fun in that.  Plus I actually think a GraphQL schema is a pretty generic way to define your data and it isn't a major leap to think it can satisfy multiple different query languages.

Starting Simple
---------------

Converting a Falcor path into a GraphQL query starts off pretty simple.  For example given the path `['viewer', 'name']` we can pop the front of the path off, put it in the query and indent a recursive call with the remaining path.

<pre>
query {
  viewer {
    name
  }
}
</pre>

Trivial!

Supporting multiple fields isn't too bad either.  For the query `['viewer', ['name', 'description']]` we can repeat the same algorithm but if we pop off an `array` we include each element of the array on the same level.

<pre>
query {
  viewer {
    name
    description
  }
}
</pre>

Arguments
---------

The first kink arrives when we add an argument such as `['repositoryById', 'facebook/react', ['name', 'description']]`.  Naively the algorithm would turn this into:

<pre>
query {
  repositoryById {
    facebook/react {
      name
      description
    }
  }
}
</pre>

Ignoring the fact that `facebook/react` is not a legal field name (heh) this is not what we want.  We want `facebook/react` to be the `id` argument to the `repositoryById` call.

<pre>
query {
  repositoryById(id: "facebook/react") {
    name
    description
  }
}
</pre>

Schema to the rescue!  Without question the best thing GraphQL does is make its schema introspective (am I using this word correctly?!).  You can query it like any other piece of data.  This allows all sorts of tooling possibilities -- for instance a data source for Falcor.

The idea is to update the algorithm and inspect if `repositoryById` takes any arguments.  If it does we continue to pop the path but use the value as the argument before continuing to the next level of the query.  To do this we need the GraphQL schema.  We can get this information straight from GraphQL with an introspection query.  If you've done any Relay work and run `update-schema`, that is exactly what is happening there:

{% highlight javascript %}

import { Schema } from '../data/schema';
import { graphql }  from 'graphql';
import { introspectionQuery, printSchema } from 'graphql/utilities';

// Save JSON of full schema introspection for Babel Relay Plugin to use
async () => {
  var result = await (graphql(Schema, introspectionQuery));
  fs.writeFileSync(
    path.join(dirname, '../data/schema.json'),
    JSON.stringify(result, null, 2)
  );
}

{% endhighlight %}

The output for our `query` type (the base type of all queries) along with the `repositoryById` field is as follows (a few fields removed for brevity):

{% highlight javascript %}

{
  "kind": "OBJECT",
  "name": "Query",
  "fields": [
    {
      "name": "repositoryById",
      "args": [
        {
          "name": "id",
          "type": {
            "kind": "NON_NULL",
            "name": null,
            "ofType": {
              "kind": "SCALAR",
              "name": "String",
              "ofType": null
            }
          },
          "defaultValue": null
        }
      ],
      "type": {
        "kind": "OBJECT",
        "name": "Repository",
        "ofType": null
      }
    }
  ]
}

{% endhighlight %}

Sweetness.  `repositoryById` takes a single non-nullable argument: `id`.  This means when we see a query like `['repositoryById', 'facebook/react', ...]` we know that the element after `repositoryById` in the path is the `id` argument to this field.  Using that knowledge we can produce the query:

<pre>
query {
  repositoryById(id: "facebook/react") {
    name
    description
  }
}
</pre>

In this example `id` was a required argument as denoted by being of kind `NON_NULL`.  The field also only had a single argument.  That isn't going to always be the case.  The algorithm needs to handle multiple arguments as well as optional arguments.

While arguments are a first class idea in GraphQL they are not in Falcor.  The premise of Falcor is you can treat the entirety of your data as a single big javascript object and you query it by navigating it like any other javascript object.  When the field has a single required argument we can approximate the literal value of the argument as a property of the parent: `repositoryById['facebook/react']`.  With optional or multiple arguments we need another strategy.

We are going to use a new field on Repository to explore this: thumbnail.  Thumbnail takes two optional arguments: width and height.  This means all of these are valid:

<pre>
query {
  repositoryById(id: "facebook/react") {
    a: thumbnail
    b: thumbnail(height: 100)
    c: thumbnail(width: 50, height: 50)
  }
}
</pre>

One strategy is to treat each argument as its own individual property with some defined order (e.g. height first, width second): `['thumbnail', 50, 100]`.  This breaks down when we can consider arguments can be optional.  To get around this we could create a `DEFAULT` constant value: `['thumbnail', DEFAULT, 100]`.  I think this would work, but has the downside that the querier needs to know the order of the arguments.  If a field takes many multiple arguments, which is probably fairly common for a collection, it can get very verbose expressing `DEFAULT` over and over again.  Also, any addition of an argument breaks all existing queries.

What I decided to do was add a function which takes a map of arguments and produces a string.  This string is then used as the property to access the json object.  So the above queries would be:

{% highlight javascript %}

var a = ['thumbnail', args()];
var b = ['thumbnail', args({height: 100})];
var c = ['thumbnail', args({width: 50, height: 50})];

{% endhighlight %}

The downside to this is we have to add an empty `args` call to a field if it takes an argument.  This means if a field goes from no arguments to some arguments we break existing queries.  It also makes the field name opaque -- you can no longer navigate the json graph without having the `args` function.

What can you do!

Ranges
------

Inside a Falcor path (query) you can express a range.  This is used for indexing into a collection.  In order to get the name of the first 5 repositories for an organization you could query: `['organizationById', 'facebook', 'repositories', {length: 5}, 'name']`.  In this query the range would be `{length: 5}` meaning to take 5 elements starting from the front of the list.  Other valid range values would be:

- `4` : a single element by index
- `[1, 3, 5]` : multiple elements by index
- `{from: 2, to: 5}` : specify a start index and an end index
- `{from: 5, length: 10}` : specify a start index and a length
- `{to: 10}` : specify an end index and the start index would be the start of the list

If there are other representations I have not seen them yet and my data source will break!

In order to make this simple I'm going to define my GraphQL collections to have two arguments -- `from` and `to` -- and convert all other range representations into that form.  The downside to this is a multiple elements range can request more data than required (e.g. `[1, 3, 5]` => `{from: 1, to: 5}`).

<pre>
query {
  organizationById(id: "facebook") {
    repositories(from: 0, to: 4) {
      name
    }
  }
}
</pre>

In order for the path parsing algorithm to work now we need to know one additional piece of information: does this field make use of a range?  If it does we now have three steps:

1. pop the name of the field
2. pop the arguments for the field (if it has any)
3. pop the range for the field (if it takes a range)

A bit of a pickle is that step 2 -- pop the arguments for the field -- also has to be aware of the range.  What I mean is that `repositories` has two arguments: `from` and `to`.  But those arguments correspond to the range.  So for step 2 we want to treat this field as if it has no arguments: e.g. `['repositories', {from: 0, to: 4}, 'name']` not `['repositories', args(), {from: 0, to: 4}, 'name']`.  To accommodate this we add that information to the schema: which arguments are range arguments and which are not.  This information is then used during parsing to determine if a field takes non-range arguments as well as range arguments.  This is a mouthful but works.

1. pop the name of the field
2. pop the non-range arguments for the field (if it has any)
3. pop the range for the field (if it takes a range)

Putting it all together we can query ranges.

Cursors
-------

In Relay pagination is not via indexing but instead uses cursors.  In order to make cursor pagination work with Falcor we need to add an adapter between the Falcor query, which uses indexes, and the Relay compliant GraphQL query, which uses cursors.  This is handled by checking the schema to see if a field meets the interface for a Relay collection.  This check might be along the lines of:

- does a field take the arguments `first`, `after`, `before`, `last`?
- does the field type have an `edges` field?
- is the `edges` type a kind of `LIST`?
- does the `edges` type have a `node` field?

You get the idea.  Using the schema we can make this check as simple or as complicated as required.  If the answer is 'yes' to all of the above, we classify this field as a Cursor Collection.  The Cursor Collection Adapter is then responsible for turning a path into a GraphQL query as well as turning a GraphQL response into a JsonGraph.

This same pattern can be used to extend the default parser to handle any special field requirements.

The Cursor Collection Adapter stores cursors from responses to make a mapping of index to cursor.  Then when new queries come in it is able to translate the ranges to `first` and `after` arguments.  Ignore `before` and `last` -- they do not exist!

Given the initial query of `['organizationById', 'facebook', 'repositories', {length: 5}, 'name']` we produce the query:

<pre>
query {
  organizationById(id: "facebook") {
    repositories(first: 5) {
      edges {
        cursor
        node {
          name
        }
      }
    }
  }
}
</pre>

The `name` field was moved down to `node` and we inserted `edges` and `cursor`.  The range was also turned into `first`.

Given the subsequent query of `['organizationById', 'facebook', 'repositories', {from: 5, length: 5}, 'name']` we produce the query:

<pre>
query {
  organizationById(id: "facebook") {
    repositories(first: 5, after: "YXJyYXljb25uZWN0aW9uOjk=") {
      edges {
        cursor
        node {
          name
        }
      }
    }
  }
}
</pre>

This introduces state into our data source -- it keeps track of previous queries cursors.

The nice thing about this is that Falcor ends up not knowing jack about cursors.  It is just any other indexable collection.

Putting It Together
-------------------

It is always nice when a bunch of individual pieces come together to make a monster.  With these rules we can run a ridiculous query and it shockingly does not explode:

{% highlight javascript %}

model.get(
  ['organization', 'facebook', ['id', 'name', 'description']],
  ['organization', 'facebook', 'created', ['month', 'day', 'year']],
  ['organization', 'facebook', 'updated', ['month', 'day', 'year']],
  ['repository', 'facebook/react', 'organization', ['name', 'description']],
  ['organization', 'facebook', 'repositories', {from: 5, length: 5}, ['name', 'description']],
  ['organization', 'facebook', 'repositoriesWithArgs', args({startsWith: 'r'}), {length: 5}, ['name']],
  ['organization', 'facebook', 'repositoriesWithArgs', args(), {length: 1}, ['name']],
  ['organization', 'facebook', 'repositoriesWithLength', 'length'],
  ['organization', 'facebook', 'repositoriesWithLength', {length: 2}, ['name', 'description']],
  ['organization', 'facebook', 'repositoriesWithCursor', {from: 5, length: 5}, ['name']],
  ['organization', 'facebook', 'thumbnail', [args(), args({height:200}), args({width:100, height:100})]],
  ['repository', 'facebook/react', ['id', 'name', 'description']],
  ['repository', 'facebook/react', 'organization', 'repositories', { length: 5 }, ['name', 'description']]
  ).then(graph => {
  console.log(JSON.stringify(graph, null, 2));
});

{% endhighlight %}

This produces the linked [GraphQL Query](https://gist.github.com/eyston/02b09d249c2d2aed0d7e) and [Falcor JsonGraph](https://gist.github.com/eyston/568cb9042f0babbb4537).  Fun stuff!

Summary
-------

The code for the data source is [here](https://github.com/eyston/falcor-graphql-experiment).  It is purely a learning experiment.  It was quite fun to make but I'm not exactly sure of its usefulness!

What I am sure of is that a GraphQL Schema is fully sufficient of expressing a Falcor data source.  I would not be surprised if it is capable of being used to satisfy an Om.Next parser.  I am a fan.

The canonical way to express a GraphQL query is a string.  I wish there was a supported data representation of a query as well.  Right now to create another query representation (e.g. a Falcor path, Om.next selector, etc) you have to parse the incoming query and produce a string for GraphQL.  I think the string representation is extremely useful for people but a peer data representation would be useful for machines.

Also when I say schema I guess there are two things: the schema shape and the schema execution (resolve functions in `graphql-js`).  The schema shape is already exposed and useful to third parties.  But the schema execution is useful outside of GraphQL as well.  Even if you never expose a GraphQL query externally being able to define an executable schema once is useful.  You can expose your data however you want with whatever query language you want -- everything you need is in that executable schema definition.

At least that is a thought.  Maybe.
