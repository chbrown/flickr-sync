### Flickr Sync

# has been deprecated!

**Please use [flickr-with-uploads](https://github.com/chbrown/flickr-with-uploads) instead.**

And don't you go thinking, "Oh, I'll just use the legacy package, it's surely better, with less fancy crap." _No._ It's more broken. That's all. The documentation is all over there, too... just not quite merged in properly, yet.

Don't worry, I care about documentation, it'll make sense again soon, but if your antsy-pants ass really wants, here's a blast from the past: the original flick-sync [README.md](README_old.md).

So, yeah. Newer, better, faster, stronger, etc. It doesn't create duplicate photosets, and it has a `cleanup` command if you have duplicate photosets you want to merge together.

[flickr-with-uploads](https://github.com/chbrown/flickr-with-uploads)

## Reasons for merging

This is a note-to-self, mostly, in case I think, sometime in the future, "Gosh, that was a stupid choice, what about modularity? This should totally be its own module!"

I will still think that, then, but here's why I merged them now:

1. I was creating a lot of ORM-type modules that correspond directly to Flickr entities, i.e, [`User`](https://github.com/chbrown/flickr-with-uploads/blob/master/orm/user.js), [`Photoset`](https://github.com/chbrown/flickr-with-uploads/blob/master/orm/photoset.js), and [`Photo`](https://github.com/chbrown/flickr-with-uploads/blob/master/orm/photo.js). These are pretty generic, and I realized they ought to go with the more general API code. This meant it would bring in a few dependencies, namely `async`, but `async` is a good library to have around, so, cool.
2. I decided that the `flickr api ...` CLI calls belong in the main API package, too. Even though that functionality is, strictly speaking, above and beyond a basic Node.js API, I can only imagine that what's useful to me is useful to others.
3. What's left? Just the `flickr sync [Photo directory]`. Yes, it's an extravagance to have it along with the rest of the API, but I didn't want to have to worry about merging CLI capabilities based on installed packages, or fracturing it into a `flickr-sync` script or something. So `flickr-sync` is along for the ride, yes, but the rest really belongs in the API package. It shouldn't interfere with the fundamental functionality of that package—the basic request/response handling help—but it should be available in that package.

The overall price? Four additional dependencies:

* [`async`](https://npmjs.org/package/async)
* [`glob`](https://npmjs.org/package/glob)
* [`streaming`](https://npmjs.org/package/streaming)
* `winston`

But I like those packages (besides `winston`), so no big deal. _I_ think it's worth it.


## License

Copyright © 2011–2013 Christopher Brown. [MIT Licensed](LICENSE).
