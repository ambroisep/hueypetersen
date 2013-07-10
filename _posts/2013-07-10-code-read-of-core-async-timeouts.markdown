---
layout: post
title: Code Read of core.async Timeouts
---

Clojure's [`core.async`](http://clojure.com/blog/2013/06/28/clojure-core-async-channels.html) library allows [go-routine style programming](http://blog.drewolson.org/blog/2013/07/04/clojure-core-dot-async-and-go-a-code-comparison/) in clojure as a library.  This is pretty fancy -- the *'as a library'* part especially.  One thing to note is that currently the `go` blocks run on a fixed threadpool of size 2 + number-of-cores.  This means if you block within a `go` thread you can end up with thread starvation -- every thread in the threadpool is blocked.  So it is key that inside the `go` blocks every operation is non-blocking.

A great of [explanation of non-blocking workflows](http://martintrojer.github.io/clojure/2013/07/07/coreasync-and-blocking-io/) was given by [Martin Trojer](https://twitter.com/martintrojer).  He examines blocking versus non-blocking web requests.  Good read.

Another note is that it [sounds like the plan](https://twitter.com/puredanger/status/354803662436048898) is to eventually allow your own executors for `core.async` which would let you have custom IO threadpools.  One example use case for this would be having a threadpool dedicated to blocking database requests while keeping your ring handlers non-blocking.  Cool stuff.  I feel like the `channel` abstraction is something Clojure can build a great non-blocking ecosystem around (think [Akka](http://akka.io/) but simple).

Timeouts
---

Any-who ... the name of the game is non-blocking.  One example of taking a blocking call and turning it into a non-blocking call is the `timeout` function in `core.async`.

{% highlight clojure %}

(let [c (chan)]
  (go
    (<! (timeout 1000))
    (>! c "hello from the future!"))
  (prn (<!! c))
  (close! c))

{% endhighlight %}

In the above sample the `go` block is non blocking (while the `<!!` does block outside the `go`).  The `(timeout 1000)` function returns a channel that will be closed after 1000 milliseconds.  Since it uses the `channel` abstraction the `<!` is able ot release control of the thread while it waits on the close.

I was interested in the mechanics of how this works.  It seems like a reasonable place to start examining the `core.async` codebase and get familiar with Java while I was at it.  I don't have a Java background so my understanding of different tools on the JVM is limited.

So, to the source!

`timers.clj`
---

Luckily the timeout stuff is in a single file, [`timers.clj`](https://github.com/clojure/core.async/blob/d81acd292311c093499d0d69f8bdd6c3c0142028/src/main/clojure/clojure/core/async/impl/timers.clj), and is only 68 lines long.  This seems tractable by even me.

{% highlight clojure %}

(ns ^{:skip-wiki true}
  clojure.core.async.impl.timers
  (:require [clojure.core.async.impl.protocols :as impl]
            [clojure.core.async.impl.channels :as channels])
  (:import [java.util.concurrent DelayQueue Delayed TimeUnit ConcurrentSkipListMap]))

(set! *warn-on-reflection* true)

(defonce ^:private ^DelayQueue timeouts-queue
  (DelayQueue.))

(defonce ^:private ^ConcurrentSkipListMap timeouts-map
  (ConcurrentSkipListMap.))

(def ^:const TIMEOUT_RESOLUTION_MS 10)

{% endhighlight %}

So the key thing here is the `:import` line.  I don't know what any of those things are.  Good times.  Immediately after we create an instance of a `DelayQueue` and `ConcurrentSkipListMap`.  I've never seen `defonce` before but a quick read of the docs says it defines the name only if it hasn't already been defined.  I'm guessing this is the singleton pattern.

`DelayQueue`
---

So what is a `DelayQueue`?  The [docs](http://docs.oracle.com/javase/6/docs/api/java/util/concurrent/DelayQueue.html) to the rescue!

> An unbounded blocking queue of Delayed elements, in which an element can only be taken when its delay has expired. The head of the queue is that Delayed element whose delay expired furthest in the past.

There are two key things here.  One is that its a [`BlockingQueue`](http://docs.oracle.com/javase/6/docs/api/java/util/concurrent/BlockingQueue.html) which means it has a blocking `take()` operation.  The second is that the elements of the queue must implement `Delayed`.

`Delayed` is an [interface](http://docs.oracle.com/javase/1.5.0/docs/api/java/util/concurrent/Delayed.html) which has one method:  `getDelay`.  `getDelay` takes a `TimeUnit` and returns the remaining delay associated with the object as a `long`.  It is pretty clear how this would be useful for the `DelayQueue`.  You can make a blocking `take` call on the queue and each of the items in the queue implements `getDelay`.

The last thing is [`TimeUnit`](http://docs.oracle.com/javase/6/docs/api/java/util/concurrent/TimeUnit.html).  Again, this is probably pedestrian Java stuff but I haven't used Java before.  `getDelay` taking a `TimeUnit` object allows the caller to specify what units they want the return value to be.  For example:

{% highlight java %}

TimeUnit.MILLISECONDS.convert(10L, TimeUnit.MINUTES)

{% endhighlight %}

This would return the number of milliseconds in 10 minutes.

Okay, so out of the list of `DelayQueue`, `Delayed`, `TimeUnit`, and `ConcurrentSkipListMap` we now understand the first three.  Progress.

`TimeoutQueueEntry`
---

The next bit of code defines a type, `TimeoutQueueEntry`.

{% highlight clojure %}

(deftype TimeoutQueueEntry [channel ^long timestamp]
  Delayed
  (getDelay [this time-unit]
    (.convert time-unit
              (- timestamp (System/currentTimeMillis))
              TimeUnit/MILLISECONDS))
  (compareTo
   [this other]
   (let [ostamp (.timestamp ^TimeoutQueueEntry other)]
     (if (< timestamp ostamp)
       -1
       (if (= timestamp ostamp)
         0
         1))))
  impl/Channel
  (close! [this]
    (impl/close! channel)))

{% endhighlight %}

This type implements two interfaces -- `Delayed` and `Channel` (`Delayed` inherits from [`Comparable`](http://docs.oracle.com/javase/6/docs/api/java/lang/Comparable.html) hence the `compareTo`) -- and takes a `channel` and `timestamp` to construct.

`getDelay` returns the difference between the `timestamp` and `(System/currentTimeMillis)` while `compareTo` just compares the `timestamp` with the other `TimeoutQueueEntry`'s `timestamp`.  `close!` is the sole method of `Channel` and it just passes the call to the internal channel.

The Meat
---

Enough setup... time for the actual `timeout` function.

{% highlight clojure %}

(defn timeout
  "returns a channel that will close after msecs"
  [msecs]
  (let [timeout (+ (System/currentTimeMillis) msecs)
        me (.ceilingEntry timeouts-map timeout)]
    (or (when (and me (< (.getKey me) (+ timeout TIMEOUT_RESOLUTION_MS)))
          (.channel ^TimeoutQueueEntry (.getValue me)))
        (let [timeout-channel (channels/chan nil)
              timeout-entry (TimeoutQueueEntry. timeout-channel timeout)]
          (.put timeouts-map timeout timeout-entry)
          (.put timeouts-queue timeout-entry)
          timeout-channel))))

{% endhighlight %}

The first thing we do is bind `timeout` to an absolute time value of milliseconds.  We then get a map entry, `me`, from the `timeouts-map` using `ceilingEntry`.  `timeouts-map` is the `ConcurrentSkipListMap` defined with `defonce` at the start of the file.  Time to figure out what that is.

`ConcurrentSkipListMap`
---

Going to the [docs](http://docs.oracle.com/javase/6/docs/api/java/util/concurrent/ConcurrentSkipListMap.html) again for `ConcurrentSkipListMap`:

> A scalable concurrent ConcurrentNavigableMap implementation. The map is sorted according to the natural ordering of its keys, or by a Comparator provided at map creation time, depending on which constructor is used.

That doesn't really help -- I don't know what a `NavigableMap` is.  How about [`NavigableMap`](http://docs.oracle.com/javase/6/docs/api/java/util/NavigableMap.html):

> A SortedMap extended with navigation methods returning the closest matches for given search targets. Methods lowerEntry, floorEntry, ceilingEntry, and higherEntry return Map.Entry objects associated with keys respectively less than, less than or equal, greater than or equal, and greater than a given key, returning null if there is no such key.

Bingo.  So `ceilingEntry` returns the map entry with a key *'greater than or equal'* to the supplied value.  The value we pass is the `timeout` value.  So we get back to the map entry with the closest timeout greater than or equal to this timeout, or `null` if none exists.  The more you know!

So how do we use this map entry?

{% highlight clojure %}

(when (and me (< (.getKey me) (+ timeout TIMEOUT_RESOLUTION_MS)))
  (.channel ^TimeoutQueueEntry (.getValue me)))

{% endhighlight %}

This bit of code is pretty cool.  We have three scenarios:

- `me` is `null` and we fail the `and` and the [`when`](http://clojuredocs.org/clojure_core/clojure.core/when) evalutes to `nil`.
- `me` has a value and the key timeout **IS NOT** within `TIMEOUT_RESOLUTION_MS` (defined as 10) so the `and` fails and the `when` evaluates to `nil`.
- `me` has a value and the key timeout **IS** within `TIMEOUT_RESOLUTION_MS` so the `and` is `true` and the `when` evaluates to the `TimeoutQueueEntry`'s `channel`.

Why do this?  It seems to be an optimiziation.  If I request 1,000 timeouts all 500 ms from now then they can all share a single channel.  That appears to be the purpose of the `ConcurrentSkipListMap` `timeouts-map`.  Neato.

This was the first expression in an `or` expression.

{% highlight clojure %}

(or (when (and me (< (.getKey me) (+ timeout TIMEOUT_RESOLUTION_MS)))
          (.channel ^TimeoutQueueEntry (.getValue me)))
    (let [timeout-channel (channels/chan nil)
          timeout-entry (TimeoutQueueEntry. timeout-channel timeout)]
      (.put timeouts-map timeout timeout-entry)
      (.put timeouts-queue timeout-entry)
      timeout-channel))))

{% endhighlight %}

The [`or`](http://clojuredocs.org/clojure_core/clojure.core/or) will short circuit and return the first logical true value, or the value of the last expression.  So if `when` returns a `channel` we are done and return the `channel` as the value of the `timeout` function.  If not we evaluate the `let` expression.

The `let` expression above creates a `channel`, a `timeout-entry`, adds it to the `timeouts-map` and the `timeouts-queue` and returns the `channel`.  So now we know how timeouts are created and put in the queue but not how they are fulfilled.

The Worker
---

The last piece is the worker which reads from the queue and writes to the `channels`.

{% highlight clojure %}

(defn- timeout-worker
  []
  (let [q timeouts-queue]
    (loop []
      (let [^TimeoutQueueEntry tqe (.take q)]
        (.remove timeouts-map (.timestamp tqe) tqe)
        (impl/close! tqe))
      (recur))))

(defonce timeout-daemon
  (doto (Thread. ^Runnable timeout-worker "clojure.core.async.timers/timeout-daemon")
    (.setDaemon true)
    (.start)))

{% endhighlight %}

The `timeout-worker` is in an infinite `loop`/`recur` blocking on `take` from the `timeouts-queue`.  When it gets an entry it removes the entry from the `timeouts-map` and closes the entries `channel`.  This `channel` could be used by many `go` block timeouts.

Since this worker is blocking we put it on its own thread -- the `timeout-daemon` thread.  Again, `defonce` makes sure we only do this once.  We create the [Thread](http://docs.oracle.com/javase/6/docs/api/java/lang/Thread.html) with the `timeout-worker` and a name.  We then make it a daemon thread and start it up.  So what is a [daemon thread](http://docs.oracle.com/javase/6/docs/api/java/lang/Thread.html#setDaemon%28boolean%29)?

> Marks this thread as either a daemon thread or a user thread. The Java Virtual Machine exits when the only threads running are all daemon threads.

So the `timeout-daemon` thread won't stop the JVM from exiting.  Makes sense.

Java, Java, Java
---

The majority of this code is built using Java constructs which I find interesting.  I don't know if I expected that or not but I have little experience interfacing Java code with Clojure code (again, not a Java guy) so enjoyed learning a bit from Java land.

Another cool thing about this is we see how `timeouts` create their own thread to handle blocking.  It is a pool of 1, so not too exciting, but shows how specialty threads can handle blocking and communicating with the non-blocking `go` threads using channels.  Useful pattern when you can't avoid blocking.

The last thing is -- what does it mean to block?  According to the docs `puts` to the queue in `timeout` can block -- *"waiting if necessary for space to become available"*.

{% highlight clojure %}

(.put timeouts-queue timeout-entry)

{% endhighlight %}

When do you care?  If its in *j.u.c* is it going to be a fast enough block that its not an issue?

Conclussion
---

So fun stuff.  I should spend more time reading code.  I'm always left wondering if my Clojure is aesthetically pleasing or not so reading code from people who do this for a living seems like a good way to develop a taste.