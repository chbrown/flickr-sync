## Flickr Backup

So Flickr offers unlimited storage for Pro accounts. This is awesome, because I have nearly unlimited photos.

They also have an awesome API, and lots of apps. But I don't trust those apps. So I made my own backuper.

Basically, it reads from a folder, which should contain a list of other folders, which in turn correspond to photosets.


## Requirements:

* [Redis](http://redis.io), and the redis python client: `pip install redis`
* [python-flickr-api](https://github.com/alexis-mignon/python-flickr-api), which is pretty new, but very nice

Run `python setup.py` to install both of the python packages. You'll need to install Redis yourself (`brew install redis` on a Mac).

## Setup:

Make a new app on Flickr, and create a file called `credentials.py`, which should look like this (after all the auth has been set up):

    api_key = 'i0LOwemEyB7SHoQgzGfvxPKjhlIbuDYs'
    api_secret = 'FnM2RhOwXjB5tVrl'
    access_token_key = 'FYSWxIJTGwvDHc98P-0n2tVdLUkmQsCBOX3'
    access_token_secret = 'H8RcVM96oLtA0Gpd'

