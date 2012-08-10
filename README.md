# Flickr Backup

Flickr offers unlimited storage for Pro accounts, and they allow you to have private photos, so they are an excellent photo backup service. They have a great API, and lots of apps. But I don't trust those apps, so I made my own backup script.

## Requirements:

* [homebrew](https://github.com/mxcl/homebrew)

You should have this already.

* [node](https://github.com/joyent/node)

Simple: `brew install node`

* [flickr-with-uploads](https://github.com/chbrown/flickr-with-uploads)
* [optimist](https://http://github.com/substack/node-optimist)
* [glob](https://http://github.com/isaacs/node-glob)

Just `npm install` to install those from the package.json file.

(I got rid of the Redis requirement, though the Python script (legacy) still requires it. Now it takes a bit longer to load up and check out your Flickr pages, but it's one less pretty big requirement, so an overall win, I think.)

## Setup:

Make a new app on Flickr, and create a file called `.env`, which should look like this (after all the auth has been set up):

    FLICKR_API_KEY=i0LOwemEyB7SHoQgzGfvxPKjhlIbuDYs
    FLICKR_API_SECRET=FnM2RhOwXjB5tVrl
    FLICKR_OA_TOKEN=FYSWxIJTGwvDHc98P-0n2tVdLUkmQsCBOX3
    FLICKR_OA_TOKEN_SECRET=H8RcVM96oLtA0Gpd

Sorry, there's not a super easy way to figure out a token and secret for yourself, at the moment. I'm working on a `phantomjs` app to do that, at the moment. 

## Instructions

Basically, it just reads from a folder, which should contain a list of other folders (which in turn correspond to photosets) containing images.

For example, here is a smidgen of my Pictures directory:

    /Users/chbrown/Pictures/
      - 20120710 Sarahs/
        - VB7O0896.JPG
        - VB7O0897.JPG
      - 20120722 Iceland - LungA/
        - VB7O3427.JPG
        - VB7O3428.JPG
        - VB7O3429.JPG
      - 20120806 Iceland - Snaefesnes/
        - VB7O3450.JPG
        - VB7O3451.JPG
        - VB7O3452.JPG
        - VB7O3453.JPG
        - VB7O3454.JPG

Each picture is about 10 MB, so for this structure and size, I would run:

    node backup.js --dir=/Users/chbrown/Pictures/Photos --workers=5

For smaller pictures, or if you have a whole lot of bandwidth, you can add more workers.
