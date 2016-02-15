---
layout: post
title: om.next from a Relay / GraphQL Perspective
---

I've recently been trying out om.next.  Previously I've been using GraphQL and Relay pretty much since they came out.  With GraphQL you could argue I've been using it since before it came out.  When I saw the first GraphQL and Relay presentations by Facebook I was convinced this was a better way to write client applications and haven't looked back.  When om.next was announced it was clear the authors shared that opinion.

I've been using om.next for 3 weeks versus several months with Relay and GraphQL.  This is extreme bias and I want to get that out of the way.

This is a "someone with months of mentality X trying out Y and noting the biggest changes to that mentality" post, not a point by point comparison of frameworks.

This is also from the perspective of using om.next with a remote.  If your use case is purely local the experience is much, much different and a lot of this won't apply.

Caching
-------

When you run the same query twice against Relay the first instance will hit the network layer (roughly analogous to a remote in om.next, but you only have one) while the second run will be satisfied by the local store.  Relay controls this local store -- it knows the format and knows how to answer the question of whether or not something is cached.

Om.next makes no assumptions about your local store.  This lets you implement the local store however you want, but also means you *have* to implement a local store.  When dealing with remotes you have an additional question of how to turn a query into a remote query.  Do you always send the remote?  If you do send the remote, do you send the whole thing or do you diff it against your local store?

These are hard questions you need to answer immediately to use remote data.

Once you make those decisions you need to write merge functions which will take that remote data and put it back into your local store.  Again, om.next has no idea what format your local store is in and by default will not deeply merge data.

If your data is all local you can side step this whole conversation and use `db->tree` and be done.

The Relay story around this is one of caching and query diffing.  As noted above, if a query can be satisfied locally it will not be sent to a remote.  Additionally Relay will diff a query.  If you run:

<pre>
query {
  currentUser {
    id
    name
    age
  }
}
</pre>

And then issue a second query:

<pre>
query {
  currentUser {
    id
    age
    birthday {
      month
      day
      year
    }
  }
}
</pre>

Then the only part which will get sent to the network layer is the difference:

<pre>
query {
  currentUser {
    birthday {
      month
      day
      year
    }
  }
}
</pre>

This behavior *can* be replicated in om.next.  It exposes all the facilities for you to create this.  The key part is -- *you create this*.

Mutations
---------

Mutations in GraphQL are a bit of a mind change in that they include a payload which you can query.

<pre>
mutation {
  addTodo(text: "Paint a self portrait") {
    todo {
      text
      completed
    }
    user {
      todosCount
      todos {
        id
        text
        completed
      }
    }
  }
}

</pre>

The above mutation both creates a todo for a user as well as return a payload with the user and todo it mutated which you can query.  Relay takes advantage of this by querying for anything which a mutation changes that it is tracking in its local store.  This ensures that as a client issues mutations it sees consistent data.

The facilities for configuring a mutation in Relay are non-trivial and the documentation is partial and sometimes wrong (I should submit a documentation PR instead of writing this sentence).  I hang out in the Relay discord chat and its safe to say mutations have a learning curve.  But once you do get beyond that learning curve they expose the tools required to keep data in sync.

Om.next mutations are different in that they do not return data.  Instead they are paired with reads in a transact.  A simple transact might look like:

<pre>
(om/transact! this `[(todo/toggle-status {:id ~id}) :completed?])
</pre>

This transaction will both mutate a todo by toggling its `:completed?` value as well as reading that value back.  So while the mutation itself returns no data the transaction as a whole is able to accomplish the same effect of mutating and reading at the same time.

In this transact we aren't actually telling the `transact!` which todo the `:completed?` key toggled on.  Om.next rolls with this by issuing a read for all `:completed?` props it is tracking.  This may or may not be what you want, but you can get around this behavior by being more explicit with your transaction.

<pre>
(om/transact! this `[(todo/toggle-status {:id ~id}) {[:todo/by-id ~id] [:completed?]}])
</pre>

No ambiguity here.

Finally you need to make sure the reads in a transact play nicely with your caching strategy.  If your caching strategy is "check the store, if its in the store, don't send it to the remote" you'll run into trouble with mutations.  This caching strategy makes perfect sense for remote reads that are part of `add-root!` and `set-query!` but don't make sense for `transact!`.  If a read is in `transact!` you *ALWAYS* want to send it to the remote.  I'm not sure of a way to determine the context of a read during parsing -- if its a `transact!` or not -- but om.next does provide the `force` function which modifies the ast of the expression and you can use that in your parser.

<pre>
(om/transact! this `[(todo/toggle-status {:id ~id}) ~(force {[:todo/by-id ~id] [:completed?]} :remote)])
</pre>

Callbacks
---------

This is continuing with mutations.  In Relay when you transact a mutation you may provide a callback which will be called once the remote mutation has either succeeded or failed.  This is used to navigate to the newly created item on creation or let the user know the mutation failed.

Om.next transactions do not take callbacks.  In order to do behavior conditional on a mutations outcome you need to make that outcome explicit in the queryable state.  This might be very similar to Redux but I'm a noob at this style!

Ident
-----

With Relay and GraphQL you must specify a schema.  With om.next you don't provide a schema but do provide `Ident` information on certain components.

<pre>
(defui User
  static
  om/Ident
  (ident [_ {:keys [id]}]
    [:user/by-id id]))
</pre>

This gives om.next information on the identity of the data required by this component.

You need to be careful to use this consistently.

<pre>
(defui Book
  static
  om/Ident
  (ident [_ {:keys [id]}]
    [:book/by-id id])
  static
  om/IQuery
  (query [_]
    [:id :text {:author [name]}]))
</pre>

This is a no-no.  The author, which has an identity, is pulled into the query directly in order to display their name.  This needs to be in a separate component which has an `Ident`.  This can lead to inconsistent views.

Fragments
---------

Relay allows composition of queries via fragments.  Each component exposes one or more fragments which constitute data requirements.  These bubble up until they finally meet a root component and get put into a query.

It is common to expose multiple fragments from a single component as well as compose multiple child fragments into a single parent fragment.

<pre>
export default Relay.createContainer(ChannelScreen, {
  fragments: {
    channel: () => Relay.QL`
      fragment on Channel {
        ${ChannelHeader.getFragment('channel')}
        ${MessageComposer.getFragment('channel')}
        ${MessageList.getFragment('channel')}
        ${MemberList.getFragment('channel')}
      }
    `,
    viewer: () => Relay.QL`
      fragment on User {
        ${MessageComposer.getFragment('viewer')}
        ${MemberList.getFragment('viewer')}
        ${ChannelHeader.getFragment('viewer')}
      }
    `
  }
});
</pre>

In the above example the component requires a 'Channel' and a 'User' and data requirements for each are composed from multiple child components.

Om.next does not make the distinction between fragments and queries.  This isn't to say it doesn't have the conceptual difference -- some queries are not 'root' queries in that they cannot be parsed.  For example `[:id :name :age]` is potentially not a parseable query -- `:id`, `:name`, and `:age` of what?  On the other hand it potentially is a parseable query -- those might be parse fields!  All queries share the same shape but you end up making a mental distinction between 'root' queries and 'child' queries.

Om.next also supports composing queries.

<pre>
(defui Book
  static
  om/Ident
  (ident [_ {:keys [id]}]
    [:book/by-id id])
  static
  om/IQuery
  (query [_]
    [:id :text {:author (om/get-query Author)}]))
</pre>

The 'Book' query has its own fields as well as the query of 'Author'.  The composition is not the same as Relay's though.  Each component can only expose a single query.  You can work around this using [links](https://github.com/omcljs/om/wiki/Thinking-With-Links%21) although with my limited experience I'm not yet sure if they are sufficient replacements for multiple fragments (they require the component to know the identity of its data requirements).

You also have to make sure when you compose queries you do not disturb metadata.

<pre>
(defui Book
  static
  om/Ident
  (ident [_ {:keys [id]}]
    [:book/by-id id])
  static
  om/IQuery
  (query [_]
    (into [:id] (concat (om/get-query BookHeader)
                        (om/get-query BookBody)))))
</pre>

This will produce a valid query, but om.next uses metadata on each part of the query to track which component a query came from.  We've just squashed 'BookHeader' and 'BookBody' into a single query.  The indexer will not be pleased and you'll run into weird issues from inside those two components.

How to compose queries in an om.next idiomatic way is something I'm still learning.  It seems common to introduce UI structure into the query as a way to compose but I'm still feeling that out.

Conclusion
----------

I don't think om.next is directly comparable to Relay.  Relay comes with a store which implements much of the functionality om.next leaves up to the developer.  Falcor is similar to Relay with their Model acting as a built in caching layer.  Both Relay and Falcor provide extensibility points in terms of a network layer for Relay and a data source for Falcor.  You can use completely local data at these extensibility points but it is in addition to, not replacement of, the local stores they both implement.

Om.next includes two extensibility points: the remotes and the parser (interface to the local store).  This gives you more control over the semantics you want the local store to have -- you can make the parser do anything.  This lack of opinion on the local store will likely mean that you are going to be building your own framework on top of what om.next provides.
