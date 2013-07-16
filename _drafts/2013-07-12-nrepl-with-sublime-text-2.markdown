---
layout: post
title: nREPL with Sublime Text 2

---

Once you use a REPL to develop Clojure with you can't go back.  Unfortunately I am bad at text editors and use Sublime Text 2 instead of Emacs or vim.  When Leiningen went to nREPL it broke the SublimeREPL plugin.  This lead to sadness and attempting to learn Emacs.  Emacs might be awesome, but I have never been one to customize my tools.  I just don't care enough.  I know this is wrong, but oh well.

All I really need is command-T, proper indentation, and a REPL.  Sublime Text 2 comes with command-T, there is an indentation plugin that works great, which meant all I was missing was a REPL.

So I decided to try and write an nREPL plugin for SublimeREPL.  I actually wrote this April 14th, 2013 but wanted to try it out for awhile and make sure it worked before doing a pull request.  Then I promptly forgot.  I am bad at open source.

Bencode
---

nREPL communicates over a socket using Bencode which is the encoding schemed used by BitTorrent.  Luckily there is a python library for Bencode so I'm good there.

Now the actual communication used by nREPL is sending maps back and forth.  Each map has an `op` entry for the operation and then operation specific entries.  A simple request to evaluate some code would look like:

{% highlight clojure %}

{ "op" "eval" "code" "(+ 1 2 3)" }

{% endhighlight %}

Easy enough.  The response then contains output, values, or errors.  This is a gross simplificiation.  I should rather say the only parts of the response I am currently handling are output, values, or errors.  I implement as much of nREPL as I've found I needed.  So for the above `eval` we would expect something like:

{% highlight clojure %}

{ "value" "6" }

{% endhighlight %}

We can also have an output for when we print to standard out.

{% highlight clojure %}

; request
{ "op" "eval" "code" "(time (reduce + (range 1e6)))" }

; response
{ "out" "\"Elapsed time: 68.032 msecs\"\n" "id" "3124d886-7a5d-4c1e-9fc3-2946b1b3cfaa" }
{ "value" "499999500000" "id" "3124d886-7a5d-4c1e-9fc3-2946b1b3cfaa" }
{ "status" ["done"] "id" "3124d886-7a5d-4c1e-9fc3-2946b1b3cfaa" }

{% endhighlight %}

So for making the worlds simplest nREPL all I have to do is send `eval` operations to the nREPL and watch for responses which have meaningful things to display.  I ignore the `id` and tracking of the status.  Not too sophisticated.

Sessions
---

This is almost everything you need to know to write an nREPL client.  There is one final detail -- sessions.  Sessions are the context in which your code is evaluated.  At least I think that is what they are.  So before you get started evaluating code you need to get a session from the server.

{% highlight clojure %}

{ "op" "clone" }

{% endhighlight %}

The response will include a session id.

{% highlight clojure %}

{ "new-session" "2ba81681-5093-4262-81c5-edddad573201" }

{% endhighlight %}

You then attach this session id to every request you make.  I left it out in the above requests so they actually look something like:

{% highlight clojure %}

{ "op" "eval" "code" "(+ 1 2 3)" "session" "2ba81681-5093-4262-81c5-edddad573201" }

{% endhighlight %}

The session id is also included in the responses.  This would let you have multiple sessions on the same server and same transport.

Integrating with SublimeREPL
---

The last piece of the puzzle is getting this to actually work in SublimeREPL.  I used the existing telnet REPL code as a starting point and duplicated whatever was necessary to get a Clojure nREPL option into the menu and a class to house all the actual