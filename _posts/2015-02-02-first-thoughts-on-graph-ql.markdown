---
layout: post
title: First Thoughts on GraphQL
---

[ReactJS Conf](http://conf.reactjs.com/) just wrapped up last week and the videos started being released over the weekend.  React Native got a lot of buzz, for extremely good reason, but equally as amazing was the [session on GraphQL](http://conf.reactjs.com/schedule.html#data-fetching-for-react-applications-at-facebook) by [Daniel Schafer](https://twitter.com/dlschafer) and [Jing Chen](https://twitter.com/jingc).

In a nutshell GraphQL allows you to query the entire state of your application in one go.  The data is returned in the minimal exact shape you request.  By itself that is pretty cool for many reasons.  But what makes it killer is that the query language composes (actually a lot of things make it killer... but lets go with this for now).  This is what lets Relay build up the query piecemeal on a component by component basis.  I highly recommend watching the [video](https://www.youtube.com/watch?v=9sc8Pyc51uU) of the session -- I can't do this thing justice in a paragraph!

Most of my work lately has been on javascript client side applications.  I'm a fan of isomorphic javascript -- but its a lot of work.  The project I'm on is rendered server side (Play / scala templates) with Backbone / Handlebars taking over on the client.  We're really looking at ways we can improve things so GraphQL immediately caught my eye.  The path I have been advocating is adding some kind of [API Gateway](http://microservices.io/patterns/apigateway.html) pattern.  Essentially we have all these different resources -- movies, series, episodes, networks, etc -- and we want to bundle them up in a page specific payload -- movie details page, networks listing page, etc.  So we'd end up with an end point per page per device -- tablet, phone, desktop -- and it would be the programmers job to make sure that end point is kept in sync every time the client is updated.

So clearly there are some downsides but it is doable.  Netflix has talked about doing similar things here with device / page specific end points.  They've described it as making part of the client run on the server.

But GraphQL is essentially the one API Gateway to rule them all.  And then you add Relay on top of it to build up the exact query you want -- oh my.

So ... basically this stuff is so cool I can't wait for it so I'm going to make a crappy implementation myself.

Roots
-----

I'm going to walk through my first expirmenting with GraphQL.  At this point the resources I know about are the session video (linked above) and the [Unofficial Relay FAQ](https://gist.github.com/wincent/598fa75e22bdfa44cf47) by [Greg Hurrell](https://twitter.com/wincent).

_NOTE: if you can answer [my question](https://gist.github.com/wincent/598fa75e22bdfa44cf47#comment-1384944) on the FAQ, please do!_

At the top level of the graph / query (not sure what to call it exactly ... lets go with graph) you have a bunch of root calls.  We can represent this as a map with each root call as a key and then the fields of that root call as the value of the key.  The shape of the root call can be whatever you want as long as it uniquely specifies the data you want.  The examples we've seen so far are `Node(id)` and `Viewer`.

One thing that I didn't really grasp watching the video but the FAQ pointed out is that `Node` and `Viewer` are not some magical GraphQL thing -- they are just implementations for Facebook's needs -- `Node` has to do with their whole Facebook Graph stuff and `Viewer` is just short hand for the current user.  This means you can create whatever root calls you need for your application.  Want the model in the root call?  Make a `Movie(12345)` root call.  Have a bunch of REST/HTTP services?  Make a `Resource(/api/movie/12345)` root call.  Want to mix github into your application?  Add a `Github(/whatever/github/looks/like)` root call.

Of course I'm just guessing.

As for the representation of this, I'm going to use a Variant (aka fancy tuple?).  As I type this I am overcome with fear that I'm using this word wrong.  But after watching [Jeanine Adkisson's](https://twitter.com/jneen_) [talk](https://www.youtube.com/watch?v=ZQkIWWTygio) at Clojure Conj I want to describe everything as a Variant.  So for `Node(12345)` we'd have `[:node 12345]` and `Viewer` is `[:viewer]` and `Resource(/api/movie/1234)` is `[:resource "/api/movie/1234"]`.  The tuple can have as many fields as it needs.

One limit of this is that our language needs to support vectors as map keys and have meaningful equality so that if we join two graphs both with `[:node 12345]` we don't end up with two keys.  Clojure is what I'm using and I *think* [immutablejs](https://github.com/facebook/immutable-js) paired with [transitjs](https://github.com/cognitect/transit-js) will work on the clientside (I want this to be true).

Fields
------

So now that we have root calls, what about the fields?  I'm going with a set that has fields as keywords or tuples (for nested fields).

{% highlight clojure %}

{
  [:node 12345] #{
    :name
    :profile_pic
    :is_verified
    [:birthday #{
      :month
      :year
    }]
  }
}

{% endhighlight %}

Representing nested fields as a tuple might end up being a terrible idea -- who knows!  I've read horror stories from Clojure people about representing trees as vectors instead of maps ... but come on, that looks so convenient / succinct.

The one thing missing is how to handle one-to-many.  Short answer -- I don't really know.

Long answer -- this is my main confusion around GraphQL at the moment.  I'm not sure how to square these two examples up:

`friends.first(1) {cursor, node {name}}`

**and**

`mutual_friends {count}`

I'd think both `friends` and `mutual_friends` are one-to-many.  I can see that you'd want a way to get the count of a one-to-many without expanding it, but I don't see how you could get a one-to-many without expanding it but also grab the first X nodes.  In the FAQ an example is shown that looks like:

`friends.first(1) {edges {cursor, node {name}}}`

This adds `edges` as a field -- which the session examples don't have -- within a one-to-many that will hold the children.  I could see adding a count to that pretty easily:

`friends.first(1) {count, edges {cursor, node {name}}}`

If that worked it would return the full count of `friends` along with the first friend's `name`.  But I don't know which representation is valid.  Either way it could still be represented using tuples (variants?) and sets.

{% highlight clojure %}

{
  [:node 12345] #{
    :name
    [:friends {:first 1} #{
      :count
      [:edges #{
        :cursor
        [:node #{
          :name
        }]
      }
    }
  }
}

{% endhighlight %}

So yah, that is ugly, but can be represented.

Implementation
--------------

Over the weekend I made a really rough implementation of the Query part of GraphQL (aka the easy 1% of all its features) before I read the Unofficial FAQ.  Then the FAQ made me hate my implementation and I'm starting over and ignoring one-to-many's for now.

So for my second take at this I'm going to make the root calls dispatch off of the first field in the variant (aka fancy tuple).  I'm using a multimethod because I like the idea of being able to extend the root calls from anywhere in code.

{% highlight clojure %}

(defmulti execute (fn [root fields context] (first root)))

;; example datomic executor
(defmethod execute :entity [[_ id] fields {:keys [db] :as context}]
  (let [entity (d/entity db id)]
    ;; expand the entity
    ))

(defn hydrate [graph context]
  (into {}
        (map (fn [[root fields]] [root (execute root fields context))]
             graph)))


{% endhighlight %}

The `execute` multimethod will probably have to become a protocol at some point to enable validation and schema definitions -- but whatever.

And lets say you want to implement the Github root call!

{% highlight clojure %}

(defmethod execute :github [[_ resource] fields context]
  ;; making a web request to github
  )

{% endhighlight %}

And now we can hydrate a graph which includes both datomic and github root calls.

{% highlight clojure %}

(hydrate {[:entity 12345] #{:name :birthday}
          [:github "/some/endpoint"] #{:latest-commit}}
         {:db :database})

{% endhighlight %}

For bonus points we can make executor's return `core.async` channels and select on them, but I got to leave something for the next blog post.

Also, `context` here is basically the request context -- if that makes sense.  A user hits an end point, you get your session, cookie, and proper parameters, etc, bundle them up and that is the context.  In this case we need our datomic database and the caller is responsible for making sure it is in the context.  This is a bit opaque but works for now.

Now we need to execute on each field.  This is going to be root call specific.

For datomic I ended up using another multimethod.  The reason I went with a multimethod is to support computed fields.  For example your database may only have `first-name` and `last-name` but you want to support `name` at a data schema level.

{% highlight clojure %}

(defmulti mapper (fn [field entity context] field))

(defmethod mapper :user/name [_ entity _]
  (str (:user/first-name entity) " " (:user/last-name entity)))

(defmethod mapper :default [field entity _]
  (get entity field))

(mapper :user/name
        {:user/first-name "Erik" :user/last-name "Petersen" :user/is-verified true}
        {}) ;; => "Erik Petersen"

(mapper :user/is-verified
        {:user/first-name "Erik" :user/last-name "Petersen" :user/is-verified true}
        {}) ;; => true

{% endhighlight %}

As you can see in the code example we leave a default implementation that simply gets at the entity itself so you only need specific overrides on a field by field basis.  One nice thing about datomic is that all fields (attributes) are namespaced so this multimethod can be universal.

In order to expand an entity we just run `mapper` on each field.  This does not handle many-to-one or one-to-many.  Again, I'm going to skip one-to-many for now but with many-to-one we can just use recursion.

{% highlight clojure %}

(defn expand-entity [entity fields context]
  (into {}
        (map (fn [field]
               (cond (vector? field) (let [[key fields] field
                                           reference (mapper key entity context)]
                                       [key (expand-entity reference fields context)])
                     :else [field (mapper field entity context)]))
             fields)))

{% endhighlight %}

I'm not sure how bullet proof this is, but with simple stuff it works.  `core.match` would be pretty swank instead of that `vector?` call.

{% highlight clojure %}

(expand-entity {:user/first-name "Erik"
                :user/last-name "Petersen"
                :user/is-verified true
                :user/birthday {:birthday/day 13
                                :birthday/month 8
                                :birthday/year 1980}}
               #{:user/name [:user/birthday #{:birthday/month :birthday/year}]}
               {})

;; => {:user/name "Erik Petersen", :user/birthday {:birthday/year 1980, :birthday/month 8}}

{% endhighlight %}

We can even make 'fake' fields.

{% highlight clojure %}

(defmethod mapper :user/best-friend [_ _ _]
  {:user/first-name "Carly Rae"
   :user/last-name "Jepsen"})

(expand-entity {:user/first-name "Pete"
                :user/last-name "Hunt"}
               #{[:user/best-friend #{:user/name}]}
               {})

;; => {:user/best-friend {:user/name "Carly Rae Jepsen"}}
;; oh, sorry if you're best friend isn't as cool as Pete Hunt's

{% endhighlight %}

So that is pretty neato.

One last example is something like `mutual_friends`.  I'm going to ignore the fact that it is one-to-many and just focus on the fact that this is a computed field that depends on context.  Your database isn't going to store the mutual friends -- it is going to store each user's friends and then do an intersection between them.  This also means you need two users -- a single entity isn't enough to describe `mutual_friends`.

We can use the context here.  The assumption is that someplace in your middleware the current user has been shoved into the context.  So if we want a `mutual_friends` computed field we would do:

{% highlight clojure %}

(defmethod mapper :user/mutual_friends [_ entity context]
  (let [current-user (:user context)]
    (set/intersection (:friends entity) (:friends current-user))))

{% endhighlight %}

Again, kind of sucks that this context is opaque.  Something along the lines of Prismatic's [plumbing](https://github.com/Prismatic/plumbing) would be cool so you could see the schema of required inputs -- but its fine for now.

Now What?
---------

This post is like 20x longer than it should be, but whatever, all this stuff is so fun I couldn't help but stream of consciousness about it.

The next steps for me are to get this second go of an implementation working and hooking it up to javascript and hoping I can represent the graph like this on the client side (fingers crossed).  The current implementation I did bubbles the body of the graph up just fine in Javascript but the way I was representing root calls was totally wrong.

{% highlight javascript %}

var query = function (component, key) {
  var params = component.queryParams
  return component.queries[key](params);
};

var FriendInfo = React.createClass({

  statics: {
    queries: {
      user: function () {
        return Immutable.Set.of(
          "user/name",
          Immutable.List.of("user/mutual-friends", Immutable.Set.of("count"))
        );
      }
    }
  }

});

var FriendListItem = React.createClass({

  statics: {
    queries: {
      user: function () {
        return Immutable.Set.of("user/is-verified")
          .union(query(ProfilePic, "user"))
          .union(query(FriendInfo, "user"))
      }
    }
  }
});

{% endhighlight %}

Of course one-to-many is important and I'm currently unsure how to handle that.  I'd also like to make a weird non-datomic root call, kind of like the Github example I threw around earlier.

Finally I'd like to get validation and schema working.  Datomic has a great schema that is just data.  The type and cardinality are right there at your fingertips!

I really can't agree with [this post](https://medium.com/@ericflo/facebook-just-taught-us-all-how-to-build-websites-51f1e7e996f2) more -- Facebook is killing it right now and I'm so glad they are sharing.