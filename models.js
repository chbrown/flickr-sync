'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var async = require('async');
var logger = require('winston');
var _ = require('underscore');
var stream = require('stream');

var FlickrPhoto = function(attributes) {
  _.extend(this, attributes);
};
FlickrPhoto.fromJSON = function(obj) {
  return new FlickrPhoto({
    id: obj.id,
    title: obj.title,
    is_public: obj.ispublic,
    is_friend: obj.isfriend,
    is_family: obj.isfamily,
  });
};

var FlickrDatabase = exports.FlickrDatabase = function(api) {
  /**
    api: initialized Flickr client request function
  */
  this.api = api;
  // this.cover_photo = Object<FlickrPhoto> with 'id' property to use for future uploads
  this.cover_photo = null;
  // this.photosets = { photoset_title: Object<FlickrPhotoset>, ...}
  // however, those flickr photosets may not be initialized
  this.photosets = null;
};
FlickrDatabase.prototype.initialize = function(callback) {
  // callback signature: function(err)
  // before this runs, FlickrDatabase.photosets == null
  // after this runs, FlickrDatabase.photosets will be at least {}
  var self = this;
  this.photosets = {};
  async.auto({
    coverPhoto: function(callback, context) {
      // get the backup-cover-photo (Flickr requires photosets to have cover photos)
      self.api({
        method: 'flickr.photos.search',
        user_id: 'me',
        tags: 'api'
      }, callback);
    },
    photosetList: function(callback, context) {
      self.api({
        method: 'flickr.photosets.getList',
        per_page: 500
      }, callback);
    },
  }, function(err, context) {
    var first_search_result = context.coverPhoto.photos.photo[0];
    logger.debug('Calling FlickrPhoto.fromJSON: ' + JSON.stringify(first_search_result, null, '  '));
    self.cover_photo = FlickrPhoto.fromJSON(first_search_result);
    logger.debug('Using cover_photo for all backups: %s', self.cover_photo.id);

    context.photosetList.photosets.photoset.forEach(function(photoset_json) {
      var photoset = FlickrPhotoset.fromJSON(self.api, photoset_json);
      // self.photosets is a map: { photoset_title -> FlickrPhotoset object, ... }
      self.photosets[photoset.title] = photoset;
    });
    logger.debug('Found %d photosets.', Object.keys(self.photosets).length);

    callback(err);
  });
};

FlickrDatabase.prototype.getPhotoset = function(photoset_title, callback) {
  // callback signature: (err, Object<FlickrPhotoset>)
  var self = this;
  var photoset = this.photosets[photoset_title];
  if (photoset) {
    if (photoset.photos) {
      callback(null, photoset);
    }
    else {
      photoset.syncPhotos(function(err) {
        callback(err, photoset);
      });
    }
  }
  else {
    photoset = new FlickrPhotoset(self.api, {
      title: photoset_title,
      description: 'flickr-sync',
      primary_photo_id: self.cover_photo.id,
    });

    // must create the photoset if it does not exist
    photoset.create(function(err) {
      // photoset.photos for a new photoset will be null
      if (err) {
        callback(err, photoset);
      }
      else {
        photoset.syncPhotos(function(err) {
          callback(err, photoset);
        });
      }
    });
  }
};

function FlickrPhotoset(api, attributes) {
  this.api = api;
  _.extend(this, attributes);
  // this.photos = {photo_title: Object<FlickrPhoto>, ...}
}
FlickrPhotoset.prototype.create = function(callback) {
  /** simply persist the photoset described by this' properties to Flickr
    callback signature: (err)
  */
  logger.debug('Creating photoset, "%s"', this.title);
  var self = this;
  this.api({
    method: 'flickr.photosets.create',
    title: this.title,
    description: this.description,
    primary_photo_id: this.primary_photo_id,
  }, function(err, response) {
    if (!err) {
      self.id = response.photoset.id;
    }
    callback(err);
  });
  // async.waterfall([], callback);
  // function(response, callback) {
  //   self.api({
  //     method: 'flickr.photosets.getInfo',
  //     photoset_id: response.id,
  //   }, callback);
  // }
};
FlickrPhotoset.prototype.syncPhotos = function(callback) {
  // callback signature: (err)
  // page through all available photos, assuming the photoset exists
  // caching retrieved photos in this.photos
  this.photos = {};
  var self = this;
  (function next(page) {
    self.api({method: 'flickr.photosets.getPhotos', photoset_id: self.id, page: page}, function(err, response) {
      if (err) {
        logger.error('Error in syncPhotos: flickr.photosets.getPhotos.');
        callback(err);
      }
      else {
        // response.photoset.photo is an array of photo_objects
        response.photoset.photo.forEach(function(photo_json) {
          var photo = FlickrPhoto.fromJSON(photo_json);
          self.photos[photo.title] = photo;
        });

        if (page < response.photoset.pages) {
          next(page + 1);
        }
        else {
          callback();
        }
      }
    });
  }(1));
};
FlickrPhotoset.prototype.getPhoto = function(photo_title) {
  // might return null
  return this.photos[photo_title];
};
FlickrPhotoset.prototype.upload = function(local_photo, callback) {
  // callback signature: function(err)
  var self = this;
  async.auto({
    upload: function(callback, context) {
      self.api({
        method: 'upload',
        title: local_photo.name,
        description: 'flickr-sync',
        tags: 'flickr-sync',
        is_public: 0,
        is_friend: 0,
        is_family: 0,
        hidden: 2,
        photo: fs.createReadStream(local_photo.filepath), // {flags: 'r'} by default
      }, callback);
    },
    addPhoto: ['upload', function(callback, context) {
      self.api({
        method: 'flickr.photosets.addPhoto',
        photoset_id: self.id,
        photo_id: context.upload.photoid._content,
      }, callback);
    }],
    getInfo: ['upload', 'addPhoto', function(callback, context) {
      self.api({
        method: 'flickr.photos.getInfo',
        photo_id: context.upload.photoid._content,
      }, callback);
    }],
  }, function(err, context) {
    if (!err) {
      var photo = FlickrPhoto.fromJSON(context.getInfo.photo);
      self.photos[photo.title] = photo;
    }
    callback(err);
  });
};
FlickrPhotoset.fromJSON = function(api, obj) {
  logger.debug('Creating FlickrPhotoset from JSON:', JSON.stringify(obj));
  return new FlickrPhotoset(api, {
    id: obj.id,
    title: obj.title._content,
    description: obj.description._content,
    primary_photo_id: obj.primary,
  });
};

var LocalPhoto = exports.LocalPhoto = function(album, name, filepath) {
  /** create a representation of a photo that exists on the local filesystem.
    album: The name of the photoset to upload this photo to (usually the parent directory's name)
    name: The title to use for this photo (usually the filename)
    filepath: The fully-specified location of the photo on the local filesystem
  */
  this.album = album;
  this.name = name;
  this.filepath = filepath;
};
LocalPhoto.stream = function(root) {
  /** returns a Readable stream of LocalPhoto objects */
  var output = stream.Readable({objectMode: true});
  // supported types listed here: http://www.flickr.com/help/photos/#150488231
  // trust Glob not to give me repeats
  var glob_stream = new glob.Glob('*/*.{gif,png,jpg,jpeg,tif,tiff}', {cwd: root, nocase: true})
  .on('match', function(match) {
    var album = path.dirname(match);
    var photo = path.basename(match);
    var local_photo = new LocalPhoto(album, photo, path.join(root, match));
    output.emit('data', local_photo);
  })
  .on('error', function(err) {
    output.emit('error', err);
  })
  .on('end', function() {
    output.push(null);
  });
  return output;
};
