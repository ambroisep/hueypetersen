---
layout: post
title: Modeling Queries in a GraphQL Like Way
---

Just to be clear if someone reads this from the future ... this is not GraphQL.  This is me making stuff up based on a [30 minute conference talk](https://www.youtube.com/watch?v=9sc8Pyc51uU) and a [gist](https://gist.github.com/wincent/598fa75e22bdfa44cf47).

Also, hello future person, thanks for stopping by.

I gave my thoughts on GraphQL [previously](/posts/2015/02/02/first-thoughts-on-graph-ql/) as well as the starting of a simple server side query implementation (which is but a small, small fraction of GraphQL).  I'd like to share the current status of that implementation which includes schemas, validations, and one-to-many's.

Schemas, Schemas, Schemas
-------------------------

My week consisted of going to work, being heavily distracted thinking about GraphQL, feeling I had solved the problem I was facing the night before, then getting home and realizing that it wouldn't work at all.

For my initial attempt I was using Datomic as the datastore but this ended up being a mistake -- Datomic is too easy.  Want to walk relationships on your data?  Just walk it like a normal clojure data structure -- Datomic will lazily do the rest.  But I want the same code to be able to walk an HTTP API or query a database, etc.  I needed something generic.

But even Datomic had issues -- when the value of an attribute is a sequence is it something I want to turn into a collection object (e.g. `friends.first(10)`) or just a component or primitive list that we include directly?  Basically I was relying on the shape of the data to create the shape of the response.

Then I saw a [tweet](https://twitter.com/stuarthalloway/status/543165130666962944) -- a beautiful, beautiful tweet -- from [Stuart Halloway](https://twitter.com/stuarthalloway):

> s/schema/power, ergo schemaless = powerless

It hit me.  I needed schemas.  Lots of them!

This was actually from December 11th, 2014 which [Stuart Sierra](https://twitter.com/stuartsierra) seemingly randomly retweeted last week.  Timely.

No need to guess on the shape of the data, just make a schema.

So the first schema is the root schema.  This is the shape of your `viewer` or `node(id)` root call.  In my case I decided to use the Github API because it has a lot of public data and is a pretty good representation of an HTTP API.  The one root I'm supporting is `organization(name)`.

{% highlight clojure %}

(def Organization
  {:name s/Str
   :description s/Str
   :email s/Str})

(def Repository
  {:id s/Int
   :name s/Str
   :full_name s/Str
   :description s/Str
   :language s/Str
   :watchers s/Int
   :forks s/Int})

(def Commit
  {:sha s/Str
   :message s/Str})

(def Author
  {:login s/Str
   :id s/Int
   :name s/Str
   :avatar_url s/Str
   :location s/Str})

{% endhighlight %}

Oh, I didn't mention, I'm using [Prismatic Schema](https://github.com/Prismatic/schema) for the schemas.

For now we only represent four resources and just a small subset of the fields on those resources.  These resources are also lacking relationships.  Lets add them now.

{% highlight clojure %}

(def OrganizationRoot
  (let [author Author
        latest-commit (-> Commit
                        (assoc :author Author))
        repository (-> Repository
                     (assoc :latest_commit latest-commit))
        repositories (graph/collection-object
                      {:first {:count PosInt}
                       :after {:cursor PosInt}}
                      s/Int
                      repository)]
    (-> Organization
      (assoc :repositories repositories))))

{% endhighlight %}

So this is not the prettiest thing ... but it works thanks to Prismatic Schemas just being data.  There are two reasons we add relationships at the end.  The first is that while the schemas can handle recursive definitions I have no desire to deal with that.  The second, and more important reason, is that I actually want the ability to only include a subset of the relationships per root call.  For instance an `author(:name)` root call might have a list of commits, but for the `organization(:name)` the author is going to be a leaf (otherwise you could have an infinite graph).

There's also a call to `collection-object` for `repositories`.  This is a helper function which takes a map of filters, a cursor schema, and a node schema and produces a collection object schema (GraphQL represents one-to-many's via collection objects).

We are left with this schema:

{% highlight clojure %}

{:name s/Str
 :description s/Str
 :email s/Str
 :repositories (collection-object
                {:filters {:first {:count PosInt}
                           :after {:cursor PosInt}}
                 :count s/Int
                 :edges [{:cursor s/Int
                          :node {:id s/Int
                                 :name s/Str
                                 :full_name s/Str
                                 :description s/Str
                                 :language s/Str
                                 :watchers s/Int
                                 :forks s/Int
                                 :latest_commit {:author {:login s/Str
                                                          :id s/Int
                                                          :name s/Str
                                                          :avatar_url s/Str
                                                          :location s/Str}
                                                 :sha s/Str
                                                 :message s/Str}}}]})}

{% endhighlight %}

This schema represents all the possible fields and relationships that are exposed by the organization root call.  This is nice because we can publish the schema for potential users as well as validate incoming queries.

Speaking of queries -- they are also modeled as a clojure data structure.

{% highlight clojure %}

;; Organization("facebook") {
;;   name,
;;   repositories.first(10) {
;;     count,
;;     edges {
;;       cusor,
;;       node {
;;         name,
;;         description
;;       }
;;     }
;;   }
;; }

[[:organization "facebook"]
 {:name nil,
  :repositories {:count nil
                 :filters {:first {:count 10}}
                 :edges {:cursor nil
                         :node {:name nil
                                :description nil}}}}]


{% endhighlight %}

This is pretty ugly compared to the string query (those nils ...) but we can validate and transform the query into the actual shape of our data using the organization root schema defined above.

{% highlight clojure %}

(graph/build OrganizationRoot query)

{% endhighlight %}

`graph/build` takes the root schema, `OrganizationRoot`, and query structure, `query`, and produces an output schema or throws an exception on an invalid query.

{% highlight clojure %}

(graph/build OrganizationRoot query)
;; {:name java.lang.String, :repositories {:edges [{:node {:description java.lang.String, :name java.lang.String}, :cursor Int}], :count Int, :filters {:first {:count 10}}}}

(graph/build OrganizationRoot (assoc query :fake-key nil))
;; ExceptionInfo Value does not match schema: #schema.utils.ErrorContainer{:error {:fake-key disallowed-key}}

{% endhighlight %}

We're now left with a query as a schema which we want to execute.  Handy!

Executors
---------

In the [Unofficial Relay FAQ](https://gist.github.com/wincent/598fa75e22bdfa44cf47) it is mentioned that GraphQL 'traverses the nodes evaluating an executor which uses the definitions from the schema to retrieve objects'.  So we have the concept of an *executor*.  Lets steal that.

{% highlight clojure %}

(defprotocol IExecutor
  (execute [this schema]))

{% endhighlight %}

An *executor* takes a schema and returns data which satisfies that schema.  A simple example would be for a leaf node in our graph -- the author of a commit.  In order to understand the task at hand we need to look at the shape of a commit and author from the Github API.

{% highlight javascript %}

// commit

{
  "sha": "60c2f56e6e30e677ba8a7a4cadf463c62589d787",
  "commit": {
    "author": {
      "name": "Paul O’Shannessy",
      "email": "paul@oshannessy.com",
    },
    "message": "Merge pull request #3074 from noyobo/master\n\nfix Chinese docs typos"
  },
  "author": {
    "login": "zpao",
    "id": 8445,
    "avatar_url": "https://avatars.githubusercontent.com/u/8445?v=3",
    "url": "https://api.github.com/users/zpao"
  }
}

// author

{
  "login": "zpao",
  "id": 8445,
  "avatar_url": "https://avatars.githubusercontent.com/u/8445?v=3",
  "url": "https://api.github.com/users/zpao",
  "name": "Paul O’Shannessy",
  "location": "San Francisco, CA"
}

{% endhighlight %}

I've limited the json to just the fields we care about.

As you can see, the commit contains much of the information about the author.  Github calls these summaries and if you've made an HTTP API you've probably done the same thing.  For example a use case comes up for showing the commit author's name but we don't want to make a request for every commit -- so lets just throw the author's name in the commit.  Oh, email too.  And login, and ... you get the idea.

This is what we do and this is what GraphQL can eliminate.

Instead we have our own public schema.

{% highlight clojure %}

(def Author
  {:login s/Str
   :id s/Int
   :name s/Str
   :avatar_url s/Str
   :location s/Str})

(def Commit
  {:sha s/Str
   :message s/Str
   :author Author})

{% endhighlight %}

Its really nice having this schema separated out.  The client can model the data without needing worry about the shape our internal data was forced into due to technical requirements.  So instead of having to know which author fields are on a commit and which are on an author (... which I really should have called user but I'm an idiot) we expose them all on author and hide whether or not a separate HTTP request was required on the server backend.

This is the job of the executors.

{% highlight clojure %}

(defrecord CommitAuthorExecutor [author]
  graph/IExecutor
  (execute [_ schema]
    (go
      (let [required-keys (into #{} (keys schema))
            missing-keys (set/difference required-keys (into #{} (keys author)))
            url (:url author)]
        (if (and (seq missing-keys) url)
          (merge author (http-get url))
          author)))))

(defrecord LatestCommitExecutor [url]
  graph/IExecutor
  (execute [_ schema]
    (let [url (clojure.string/replace url #"\{\/sha\}" "")
          commits (http-get (str url "?per_page=1"))
          commit (first commits)]
      (-> commit
        (assoc :author (CommitAuthorExecutor. (merge (:author commit) (get-in commit [:commit :author]))))))))

{% endhighlight %}

So this code is a bit rough -- work in progress I say!

Lets start with the second executor: `LatestCommitExecutor`.  This executor requires a url (in this case "https://api.github.com/repos/facebook/react/commits{/sha}") and when executed fetches that url and pulls the first commit from the result.  It then associates a second executor, `CommitAuthorExecutor`, on to the result under the key `:author`.

I don't want to get too much into the details, but when walking the graph if an 'IExecutor' is encountered as the value of a field it is executed with the expected schema.

{% highlight clojure %}

(defn walk [schema data]
  (let [data (if (satisfies? IExecutor data) (execute data schema) data)]
    ;; ...
    ))

{% endhighlight %}

So in our above case, if the schema for the commit doesn't include any information about the author we'll never execute the `CommitAuthorExecutor` executor.

{% highlight clojure %}

(execute (LatestCommitExecutor. "https://api.github.com/repos/facebook/react/commits{/sha}")
         {:sha s/Str})
;; CommitAuthorExecutor IS NOT executed

(execute (LatestCommitExecutor. "https://api.github.com/repos/facebook/react/commits{/sha}")
         {:sha s/Str :author {:name s/Str}})
;; CommitAuthorExecutor IS executed

{% endhighlight %}

The `CommitAuthorExecutor` is neat in that it may or may not make an HTTP request.  It checks if the data it has from the commit is enough to satisfy the query schema.  If it is, no HTTP request is made.  If it is not, we fetch the full author resource from Github.  In our case the only field which forces an HTTP request is *location*.

This pattern is how I model the whole server side query execution.  We start with a root executor, in this case an `OrganizationRootExecutor` and just walk the desired output schema calling any executors we meet along the way.  Only as much work is done as is minimally required.

One-to-Many
-----------

One last example of an executor is handling a one-to-many.  In the current graph we only have one of those -- Organizations to many Repositories.

{% highlight clojure %}

(defrecord RepositoriesExecutor [url count]
  graph/IExecutor
  (execute [_ schema]
    (let [filters (:filters schema)]
      {:count count
       :filters filters
       :edges (let [repos (lazy-resources url)
                    repos ( ... apply filters ...)]
                (map (fn [repo]
                       {:cursor (:id repo)
                        :node (RepositoryExecutor. repo)})
                     repos))))})))

{% endhighlight %}

This code does three main things:

- produce the shape of a collection object -- count, edges, cursors, and nodes
- filter the collection with the supplied filters (left out above, but shown below)
- setup each node with an executor

We are making use of the lazyness of sequences here.  All of the work to create the edges isn't done until the first item is taken from the sequence.  And then any work to create the individual repositories isn't done until the node is walked.

`lazy-resources` is kind of cool.  You give it a url and it will page through the results on demand -- but again, not until you take the first item from the sequence.

{% highlight clojure %}

(defn lazy-resources
  ([url]
   (lazy-resources url 1))
  ([url page]
   (lazy-seq (let [paged-url (str url (when (> page 1) (str "?page=" page)))
                   resources (http-get paged-url)]
               (if (seq resources)
                 (lazy-cat resources (lazy-resources url (inc page)))
                 resources)))))

(lazy-resources "https://api.github.com/orgs/facebook/repos")
;; no HTTP request

(take 1 (lazy-resources "https://api.github.com/orgs/facebook/repos"))
;; HTTP request for page 1

(take 50 (lazy-resources "https://api.github.com/orgs/facebook/repos"))
;; HTTP request for page 1 and 2

(into [] (lazy-resources "https://api.github.com/orgs/facebook/repos"))
;; HTTP request for every page until we get an empty result

{% endhighlight %}

This makes implementing the filters trivial.  First is a simple `take` and after is a `drop-while`.

{% highlight clojure %}

;; first
(take (:count filter) repos)

;; after
(let [cursor (:cursor filter)]
  (->> repos
    (drop-while #(not= cursor (:id %)))
    (drop 1))))

{% endhighlight %}

This does have limits -- the cursor is very dumb, just an id.  A smarter cursor could include a page number at which point we wouldn't want to start at the first page.

The full filtering code is just a reduce over the filters.

{% highlight clojure %}

(let [repos (lazy-resources url)
      repos (reduce (fn [repos filter-key]
                      (if-let [filter (get filters filter-key)]
                        (condp = filter-key
                          :first (take (:count filter) repos)
                          :after (let [cursor (:cursor filter)]
                                   (->> repos
                                     (drop-while #(not= cursor (:id %)))
                                     (drop 1))))
                        repos))
                    repos
                    [:after :first])]

{% endhighlight %}

One drawback of the way I model filters in the query is that they are a map -- we lose the call order.  Instead the call order is specified in the *executor* (e.g. `[:after :first]`).  I'm not sure if that is going to end up limiting things.

Another point is that each collection specifies which filters it supports.  An [example](https://twitter.com/schrockn/status/562779242795401217) from Nick Schrock is a `birthday_in_range` filter on the `friends` one-to-many.  Clearly not every one-to-many will support `birthday_in_range` so the schema needs to be able to specify which filters are valid.

Our Repositories schema expands to:

{% highlight clojure %}

{:filters {:first {:count PosInt}
           :after {:cursor PosInt}}
 :count s/Int
 :edges [{:cursor s/Int
          :node {:id s/Int
                 :name s/Str
                 :full_name s/Str
                 :description s/Str
                 :language s/Str
                 :watchers s/Int
                 :forks s/Int}}]}

{% endhighlight %}

Right there in the schema we say which filters are supported (first and after) as well as the arguments expected.  If we want to add a new filter, we can.

{% highlight clojure %}

;; updated schema
{:filters {:first {:count PosInt}
           :after {:cursor PosInt}
           :language {:name s/Str}}}

;; implementation in the executor

(filter #(= (:language filter) (:language %)) repos)

{% endhighlight %}

Sample Request
--------------

For now I have a hard coded query -- I need to write the client side of the story in order to generate queries on demand plus I don't want to piss off Github since it isn't hard to make a query that would trigger 100's of HTTP requests.  The result can be viewed in [this gist](https://gist.github.com/eyston/82e010ec755e4147c87b) or hitting a [heroku end point](https://hueyql.herokuapp.com/api/graph) which I don't know how long I'll keep up.  The [code is on github](https://github.com/eyston/hueyql) but don't expect much -- my understanding of GraphQL changes every day and this is the first non-trivial thing I've done with Clojure.

Looking Forward
---------------

So this executor thing works but I could see writing them getting tedious.  I mean, I already hate it and I've written like five.  They are also opaque -- these function calls which might call other function calls which might result in HTTP requests but none of that is visible.  What I'd like to do is represent executors as edges between schemas.

The first thing to realize is that the [Github HTTP response](https://api.github.com/repos/facebook/react/commits/60c2f56e6e30e677ba8a7a4cadf463c62589d787) for a commit is not the `Commit` schema of your API.  Instead you want to model it as its own personal schema -- `CommitResponse`.  You might also want to massage the JSON into a more fitting shape which could be a new schema -- `CommitResource`.  So you can end up with an edge between `CommitResponse` and `CommitResource` which is the result of applying a transform function (*executor?*).

An incoming query has its own schema which is strictly a subset of the full `Commit` schema (the public one of your API).  I want to be able to model the steps required to fulfill the data for that schema.

We end up with a graph.

{% highlight clojure %}

(def CommitRoot
  {:sha s/Str})

(def Commit
  {:sha s/Str
   :message s/Str})

(def CommitResource
  {:sha s/Str
   :commit {:message s/Str}})

(def query
  {:sha s/Str
   :message s/Str})

(def edges
  CommitRoot {:result CommitResource
              :executor some-http-request-fn}
  CommitResource {:result Commit
                  :executor some-transform-fn})

{% endhighlight %}

Our starting point will be a query schema -- which is a subset of `Commit` -- and a commit root call `Commit("sha")` which has a schema `CommitRoot`.  An edge has been defined between `CommitRoot` and `CommitResource`.  In this case executing that edge is going to make an HTTP response.  There is then another edge to go between `CommitResource` to `Commit` which purely transforms the data between representations.

At this point I'd love to be able to say `(plan CommitRoot query)` and have something come out -- I'm not sure exactly what.  This would now make my execution of a query representable as data.  That seems much better than having it be an opaque function.

This should sound familiar -- it is the same motivation around [Prismatic Graph](https://github.com/Prismatic/plumbing).  I need to think harder about whether this can just be thrown into that library.

Another benefit of query as data is it opens up the possibilities of middleware.  I'd love to execute a query and then get information about how long each executor took, how many http requests were made, etc.  That would be sweet.

So ya, I have another week of being distracted at work to look forward to.  Thanks Facebook!