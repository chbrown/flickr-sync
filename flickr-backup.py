#!/usr/bin/env python
import os
import re
import sys
import time
from datetime import datetime
import redis
import flickr_api
from credentials import api_key, api_secret, access_token_key, access_token_secret

img_re = re.compile('(png|jpg|jpeg)', re.I)

r = redis.Redis()

flickr_api.set_keys(api_key=api_key, api_secret=api_secret)

if access_token_key and access_token_secret:
    flickr_auth = flickr_api.auth.AuthHandler(api_key, api_secret,
        access_token_key=access_token_key, access_token_secret=access_token_secret)
    flickr_api.set_auth_handler(flickr_auth)
else:
    flickr_auth = flickr_api.auth.AuthHandler(callback="http://flickr.com/")
    flickr_auth.get_authorization_url(perms='delete')
    flickr_auth.set_verifier('copy & paste from url or something')
    flickr_auth.save(auth_path)

user = flickr_api.test.login()
cover_photo = flickr_api.Photo.search(user=user, title='flickr-store', tags='api')[0]


class LocalPhoto(object):
    def __init__(self, album, title, fullpath):
        self.album = album
        self.title = title
        self.fullpath = fullpath

    @property
    def cache_key(self):
        return 'flickr:%s' % self.fullpath

    def ensure_photoset(self):
        """Returns a Photoset object"""
        # first check that the photo has been not already been uploaded (once more, with passion)
        for photoset in user.getPhotosets(per_page=500):
            if photoset.title == self.album:
                return photoset
        return flickr_api.Photoset.create(title=self.album,
            description='flickr-store', primary_photo=cover_photo)

    def ensure_photo(self):
        """Returns a string"""
        cached = r.get(self.cache_key)
        if not cached:
            album_photoset = self.ensure_photoset()

            # page through all the photos
            photoset_photos = album_photoset.getPhotos()
            for page in range(2, photoset_photos.info.pages + 1):
                photoset_photos += album_photoset.getPhotos(page=page)

            # print '     > already exists! %s' % matching_photos[0].getPageUrl()
            for photo in photoset_photos:
                if photo.title == self.title:
                    result = 'already on flickr'
                    r.set(self.cache_key, result)
                    return result, 0

            photo = flickr_api.upload(photo_file=self.fullpath, title=self.title,
                is_public=0, is_friend=0, is_family=0, hidden=2)
            photo.setPerms(is_public=0, is_friend=0, is_family=0, perm_comment=0, perm_addmeta=0)
            album_photoset.addPhoto(photo=photo, description='flickr-store', tags='flickr-store', hidden=2)

            result = 'uploaded at %s' % datetime.now().strftime('%Y-%m-%dT%H-%M-%S')
            r.set(self.cache_key, result)
            return result, os.path.getsize(self.fullpath)
        else:
            return 'CACHE: %s' % cached, 0


class LocalFolder(object):
    def __init__(self, base_path):
        self.photos = []
        for album in os.listdir(base_path):
            album_path = os.path.join(base_path, album)
            if os.path.isdir(album_path):
                for photo in os.listdir(album_path):
                    photo_path = os.path.join(album_path, photo)
                    if img_re.search(photo_path):
                        local_photo = LocalPhoto(album, photo, photo_path)
                        self.photos.append(local_photo)


base_path = sys.argv[-1]
started = time.time()
while True:
    try:
        local = LocalFolder(base_path)
        total_uploaded = 0
        for i, photo in enumerate(local.photos):
            result, uploaded = photo.ensure_photo()
            total_uploaded += uploaded
            rate = (total_uploaded / 1000.0) / (time.time() - started)
            print '%5d/%5d (%.3f kB/s): %s -> %s' % (i, len(local.photos), rate, photo.fullpath, result)
        print 'Totally finished'
        break
    except Exception, exc:
        print exc
        time.sleep(10)
        print 'Slept 10s. Continuing...'

print 'Exiting'
