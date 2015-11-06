---
layout: post
title: Instrumenting graphql-js for Query Timing
---

One of my dreams is to write a short blog post.  I have high hopes this will be one!

In the [reactiflux discord chat](http://www.reactiflux.com/) I noticed some talk about instrumenting GraphQL to get timing information on query execution.  This sounded neat so I gave it a shot in `graphql-js`.

A gist of the code snippets is [here](https://gist.github.com/eyston/7ec48ceb30213e7fbb36) and the output it produces looks like such:

{% highlight javascript %}

{
  "data": { ... } // your query result
  "timing": {
    "duration": 3.345,
    "fields": [{
      "type": "Todo",
      "field": "completed",
      "args": {},
      "duration": 0.759
    },{
      "type": "Viewer",
      "field": "todos",
      "args": {},
      "duration": 1.719
    }] // repeat for all fields ...
  }
}

{% endhighlight %}

Schema
------

When GraphQL executes it walks the query executing the schema resolve functions along the way.  The information we are interested in is how long each resolve function takes to execute.  This can be accomplished by wrapping the resolve function.

{% highlight javascript %}

let timings = [];

const withTiming = next => {
  return (obj, args, info) => {
    const start = new Date().getTime();
    return Promise.resolve(next(obj, args, info)).then(res => {
      timings.push({
        type: info.parentType.name,
        field: info.fieldName,
        args,
        duration: (new Date().getTime() - start) / 1000
      });
      return res;
    });
  }
}

const ViewerType = new GraphQLObjectType({
  name: 'Viewer',
  fields: {
    todos: {
      type: new GraphQLList(TodoType),
      resolve: withTiming(user => db.getTodos(user.id))
    }
  }
});

{% endhighlight %}

Now when `Viewer#todos` is resolved a new timing entry will be added to `timings`.  Adding it to an array is not very exciting but imagine logging it or putting it in some stats / metrics system.  You get the idea!

But what if we want this for *every* field?  It would be annoying to manually add this on every entry.  Instead we can walk the schema and wrap resolve functions along the way.

The `graphql-js` schema maintains a map of name to type of all of its types.  This can be accessed via `Schema#getTypeMap`.  Each object type then has a map of name to fields for all of its fields.  This can be accessed via `Type#getFields`.  Using these two methods we can walk over every single field of our schema and wrap resolve functions along the way.

{% highlight javascript %}

import {GraphQLObjectType} from 'graphql/type/definition';

// taken from https://github.com/graphql/graphql-js/blob/60e55da31f761303f60bc8258a71d278939e52c0/src/execution/execute.js#L766
function defaultResolveFn(source, args, { fieldName }) {
  var property = source[fieldName];
  return typeof property === 'function' ? property.call(source) : property;
}

const schemaFieldsForEach = (schema, fn) => {
  Object.keys(schema.getTypeMap())
    .filter(typeName => typeName.indexOf('__') !== 0) // remove schema fields...
    .map(typeName => schema.getType(typeName))
    .filter(type => type instanceof GraphQLObjectType) // make sure its an object
    .forEach(type => {
      let fields = type.getFields();
      Object.keys(fields).forEach(fieldName => {
        let field = fields[fieldName]
        fn(field, type);
      });
    });
}

schemaFieldsForEach(schema, (field, type) => {
  field.resolve = withTiming(field.resolve || defaultResolveFn);
});

{% endhighlight %}

Since we wrap every resolve function we can no longer rely on `graphql-js` to handle `null` resolve functions with a default for us.  Instead we explicitly add the `defaultResolveFn` if the resolve is `null`.

Also, since you have the type and field information handy you could filter down even further which fields you want to get timing information on.  For example if all of your resolve functions which return scalars are just fields on the parent object you could exclude them from your timing.

{% highlight javascript %}

import {GraphQLScalarType} from 'graphql/type/definition';

schemaFieldsForEach(schema, (field, type) => {
  if (!(field.type instanceof GraphQLScalarType)) {
    field.resolve = withTiming(field.resolve || defaultResolveFn);
  }
});

{% endhighlight %}

The schema being data you can work with opens this up.  Just be careful that you only wrap the schema once.  You are mutating the schema in place -- not returning a new schema.

Resolve Composition
-------------------

At the end of the day all we are doing is function composition.  This means we don't have to stop at a single resolve wrapper.

{% highlight javascript %}

const wrapPromise = (next) => {
  return (obj, args, info) => {
    try {
      return Promise.resolve(next(obj, args, info));
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

const withLogging = (next) => {
  return (obj, args, info) => {
    console.log(`resolving: ${info.parentType.name}#${info.fieldName}`);
    return next(obj, args, info);
  }
}

const withRandomDelay = (max) => {
  return (next) => {
    return (obj, args, info) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          next(obj, args, info).then(resolve, reject);
        }, Math.floor(Math.random() * max))
      });
    }
  }
}

schemaFieldsForEach(schema, (field, type) => {
  field.resolve = withTiming(withRandomDelay(1000)(withLogging(wrapPromise(field.resolve || defaultResolveFn))));
});

{% endhighlight %}

In this case we are getting timing information, adding a random delay, logging resolves, and wrapping the result in a promise (simplifies other functions if they can assume promise).

Exposing in Response
--------------------

GraphQL allows adding keys to the response beyond `data` and `errors`.  We can add one for timing if we wanted to expose this information in the response.

This is a bit hacky in that we need some kind of per-request context that is both accessible to the resolve functions as well as the `graphql` caller.  `graphql-js` has an execution context that is per request and provided to every resolve function (its part of the third argument to resolve).  Unfortunately I'm not aware of a way for the `graphql` caller to get this information.

But that same third argument includes the `rootValue` which the caller most definitely has access to.  So we'll use that.

{% highlight javascript %}

let rootValue = {

  // ... put whatever you normally need in here ...

  // we'll shove our results in this guy!
  response: {
    timing: {
      fields: []
    }
  }
}

const start = new Date().getTime(); // for good measure we'll time the whole thing
return graphql(schema, query, rootValue, variables).then(response => {
  rootValue.response.timing.duration = (new Date().getTime() - start) / 1000;
  return {...response, ...rootValue.response};
});

{% endhighlight %}

And then in our resolve function we'll push timing information into this part of the `rootValue`.

{% highlight javascript %}

const withTiming = (next) => {
  return (obj, args, info) => {
    const start = new Date().getTime();
    return Promise.resolve(next(obj, args, info)).then(res => {
      info.rootValue.response.timing.fields.push({
        type: info.parentType.name,
        field: info.fieldName,
        args,
        duration: (new Date().getTime() - start) / 1000
      });
      return res;
    });
  }
}

{% endhighlight %}

Our graphql result now includes a third key: `timing`.

{% highlight javascript %}

{
  "data": { ... } // your query result
  "timing": {
    "duration": 3.345,
    "fields": [{
      "type": "Todo",
      "field": "completed",
      "args": {},
      "duration": 0.759
    },{
      "type": "Viewer",
      "field": "todos",
      "args": {},
      "duration": 1.719
    }] // repeat for all fields ...
  }
}

{% endhighlight %}

Summary
-------

So the two key ideas here are:

- the `graphql-js` schema is data you can inspect and work with
- resolve functions are just functions and you can compose them

The composition stuff is equally useful for authorization -- another frequent GraphQL *how-do-I* question.

{% highlight javascript %}

const ViewerType = new GraphQLObjectType({
  name: 'Viewer',
  fields: {
    todos: {
      type: new GraphQLList(TodoType),
      // can style
      resolve: canViewTodos(user => db.getTodos(user.id))
    },
    email: {
      type: GraphQLString,
      // role style
      resolve: hasRole('admin')(user => user.email)
    }
  }
});

{% endhighlight %}

Finally -- should you do this?  GraphQL is a thin abstraction over your data store.  Maybe you should be timing your data store instead?  For instance am I better off knowing how long `db.getTodos` takes instead of my `User.todos` resolve function?  I don't know, but you can't go wrong timing both!  And even if you only time one the fact that GraphQL makes it so easy to time *everything* makes it pretty attractive as a starting point.
