---
layout: post
title: Normalizr with GraphQL
---

I'm in a situation where I'm not using Relay but still want to use GraphQL.  The correct answer is -- use Relay.  But in case you still ignore that answer I decided to write a small tool to leverage the [Normalizr](https://github.com/gaearon/normalizr) library with GraphQL.

Normalizr can take a nested data structure and flatten it out according to a schema.  Guess what -- GraphQL has a schema!  The GraphQL schema is not what Normalizr expects, but it has all the information in order to create a Normalizr schema.  So thats what I did.

Given the following query of a user and their todos:

<pre>
query {
  viewer {
    todos {
      text
      complete
    }
  }
}
</pre>

We can produce the normalized output:

{% highlight javascript %}

{
  "result": {
    "data": {
      "viewer": 1
    }
  },
  "entities": {
    "User": {
      "1": {
        "id": 1,
        "todos": [1, 2]
      }
    },
    "Todo": {
      "1": {
        "id": 1,
        "text": "Learn GraphQL",
        "complete": true
      },
      "2": {
        "id": 2,
        "text": "Buy a unicorn",
        "complete": false
      }
    }
  }
}

{% endhighlight %}

How to Use
----------

In order to generate a Normalizr schema the tool needs a JSON version of the schema.  To generate the JSON schema I used a [snippet](https://github.com/facebook/relay/blob/master/examples/todo/scripts/updateSchema.js) stolen from the Relay examples.  If you are using a non-javascript GraphQL server it should have a similar facility to output a schema introspection.

Given the GraphQL schema we can now create a Normalizr schema for any valid GraphQL query.

{% highlight javascript %}

import {normalize} from 'normalizr';
import {querySchema} from 'normalizr-graphql/query';
import jsonSchema from './data/schema.json';

const query = querySchema(jsonSchema, `
  query {
    viewer {
      todos {
        text
        complete
      }
    }
  }
`);

const result = normalize({
  data: {
    viewer: {
      id: 1,
      todos: [{
        id: 1,
        text: 'Learn GraphQL',
        complete: true
      }, {
        id: 2,
        text: 'Buy a unicorn',
        complete: false
      }]
    }
  }
}, query.schema);

// result
// {
//   "result": {
//     "data": {
//       "viewer": 1
//     }
//   },
//   "entities": {
//     "User": {
//       "1": {
//         "id": 1,
//         "todos": [1, 2]
//       }
//     },
//     "Todo": {
//       "1": {
//         "id": 1,
//         "text": "Learn GraphQL",
//         "complete": true
//       },
//       "2": {
//         "id": 2,
//         "text": "Buy a unicorn",
//         "complete": false
//       }
//     }
//   }
// }

{% endhighlight %}

The same thing can also be accomplished via a Babel plugin.

{% highlight javascript %}

import {normalize} from 'normalizr';
import NormalizeQL from 'normalizr-graphql';

const query = NormalizeQL`
  query {
    viewer {
      todos {
        text
        complete
      }
    }
  }
`;

const result = normalize({
  // ...
}, query.schema);

{% endhighlight %}

The benefit of the Babel plugin is that the JSON schema and GraphQL do not need to be included in your client javascript bundle.  The only dependency of the plugin output is Normalizr which should already be included.

How it Works
------------

Internally the `querySchema` and plugin code both work by parsing the query into the GraphQL AST.  This AST doesn't have any type information which is what we need in order to properly create the Normalizr schema.  The type information comes from the JSON GraphQL schema.  The GraphQL query AST is walked and the current type is looked up from the GraphQL schema.  As the AST descends fields the current type is updated from the field type looked up in the schema.  Whenever an entity is encountered a new `Schema` is created.  Whenever a `List` is encountered a new `arrayOf` is created.  This continues from top to bottom of the query.

The output of the above example query for todos would look like:

{% highlight javascript %}

const schema = {
  data: {
    viewer: schemaExpression('User', {
      todos: arrayOf(schemaExpression('Todo', {}))
    })
  }
};

{% endhighlight %}

`schemaExpression` is just a helper function which turns the creation of a new `Schema` into an expression.

{% highlight javascript %}

const schemaExpression = (key, definition) => {
  const schema = new Schema(key);
  schema.define(definition);
  return schema;
}

{% endhighlight %}

As a query gets deeper and more complicated the schema grows and grows.

One question might be: why nest the schemas?  For instance it would be possible to generate a single schema each for `User` and for `Todo` no matter how many times they appear in a query.  The answer: aliases.  Each `User` and `Todo` can define its own aliases which necessiates them having a unique schema per field.

Unions and Interfaces
---------------------

The last wrinkle are Unions and Interfaces.  Normalizr has support for `arrayOf` being a Union of multiple types.  But this support is not extended to non-array fields.  For example I might have a `Group` type where the `owner` is another `Group` or a `User`.  GraphQL requires that this be supported and Normalizr does not.  I have a [pull-request](https://github.com/gaearon/normalizr/pull/42) which adds the `unionOf` function which extends Union support to fields.  Right now I have to use my own version of Normalizr until if/when this gets merged.

With the `unionOf` support in Normalizr then Unions and Interfaces can both be handled.  Given a schema of `Group` which has an `owner` and `members` which can each be a `Group` or `User` we can normalize the following query:

{% highlight javascript %}

import {normalize} from 'normalizr';
import {querySchema} from 'normalizr-graphql/query';
import jsonSchema from './data/schema.json';

const query = querySchema(jsonSchema, `
  query {
    group(id: 1) {
      owner {
        ...on User {
          name
        }
        ...on Group {
          name
        }        
      }
      members {
        ...on User {
          name
        }
        ...on Group {
          name
        }
      }
    }
  }
`);

const result = normalize({
  data: {
    group: {
      id: 1,
      owner: {
        id: 1,
        __typename: 'User',
        name: 'Huey'
      },
      members: [{
        id: 1,
        __typename: 'User',
        name: 'Huey'
      }, {
        id: 2,
        __typename: 'Group',
        name: 'SuperFunClub'
      }]
    }
  }
}, query.schema);

// result
// {
//   "result": {
//     "data": {
//       "group": 1
//     }
//   },
//   "entities": {
//     "User": {
//       "1": {
//         "id": 1,
//         "__typename": "User",
//         "name": "Huey"
//       }
//     },
//     "Group": {
//       "1": {
//         "id": 1,
//         "owner": {
//           "id": 1,
//           "schema": "User"
//         },
//         "members": [{
//           "id": 1,
//           "schema": "User"
//         }, {
//           "id": 2,
//           "schema": "Group"
//         }]
//       },
//       "2": {
//         "id": 2,
//         "__typename": "Group",
//         "name": "SuperFunClub"
//       }
//     }
//   }
// }

{% endhighlight %}

The schema generated for the above query would look like:

{% highlight javascript %}

const schema = {
  data: {
    group: schemaExpression('Group', {
      owner: unionOf({
        User: schemaExpression('User', {}),
        Group: schemaExpression('Group', {})
      }, { schemaAttribute: '__typename' }),
      members: arrayOf(unionOf({
        User: schemaExpression('User', {}),
        Group: schemaExpression('Group', {})        
      }, { schemaAttribute: '__typename' }))
    })
  }
};

{% endhighlight %}

Interfaces are handled as unions too.  The interface fields are shoved into the schema for every possible type.

Magic
-----

One last bit -- the query string itself is updated by the plugin and `querySchema` method.  This is done to insert `id` and `__typename` where appropriate.

Next Steps
----------

The code is on [github](https://github.com/eyston/normalizr-graphql).

I'm probably going to make use of this since I still have some projects not using Relay and I can't give up GraphQL.  It might be useful for people who don't want to give up Redux but want to bask in the glory that is GraphQL.

The main issue with the code is it requires a custom version of Normalizr installed along side it.  If I can get `unionOf` merged into Normalizr and anyone finds this useful I can make an `npm` module.  Ping me on [twitter](https://twitter.com/hueypetersen).
