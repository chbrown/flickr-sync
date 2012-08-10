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

## Example responses:

flickr.photosets.getList

    {
      photosets: {
        photoset: [
          { id: '72157630888396238', primary: '7500858540', secret: '6acdf92dec', server: '8014', farm: 9, photos: 3, videos: '0', title: { _content: '20120716 Iceland - Reykjavik' }, description: { _content: 'flickr-store' }, needs_interstitial: 0, visibility_can_see_set: 1, count_views: '0', count_comments: '0', can_comment: 1, date_create: '1344024608', date_update: '1344024918' },
          ...
        ],
      }
    }

flickr.photos.search

    {
      photos: {
        photo: [
          { id: '7500858540', owner: '33947520@N00', secret: '6acdf92dec', server: '8014', farm: 9, title: 'flickr-store', ispublic: 0, isfriend: 0, isfamily: 0 }
        ],
        ...
      }
    }

flickr.test.login

    {
      user: { id: '33947520@N00', username: { _content: 'audiere' } },
      stat: 'ok'
    }

