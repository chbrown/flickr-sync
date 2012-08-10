var flickr_client = require('./flickr_client'),
  fs = require('fs'),
  logerr = function(err) { if (err) console.log("ERR", err); };



function FlickrDatabase(backup_cover_photo) {
  this.backup_cover_photo = backup_cover_photo;

  // photosets is {photoset_title: <FlickrPhotoset> object, ...}
  this.photosets = {};
}
FlickrDatabase.prototype.init = function(photoset_titles, callback) {
  var self = this;
  this.syncPhotosets(function() {
    // preload albums
    (function next() {
      var photoset_title = photoset_titles.shift();
      if (photoset_title !== undefined) {
        self.getPhotoset(photoset_title, function(photoset) {
          console.log("Syncing photoset:", photoset.title);
          photoset.sync(next);
        });
      }
      else {
        callback();
      }
    })();
  });
};

FlickrDatabase.prototype.addPhotoset = function(raw_photoset) {
  var title = raw_photoset.title._content,
    photoset = this.photosets[title] = new FlickrPhotoset(title, raw_photoset);
  return photoset;
};
FlickrDatabase.prototype.syncPhotosets = function(callback) {
  // callback signature: ()
  var self = this;
  flickr_client.api('flickr.photosets.getList', {per_page: 500}, function(err, response) {
    logerr(err);
    response.photosets.photoset.forEach(function(photoset) {
      self.addPhotoset(photoset);
    });
    callback();
  });
};
FlickrDatabase.prototype.getPhotoset = function(photoset_title, callback) {
  // callback signature: (<FlickrPhotoset> object)
  var self = this,
    photoset = this.photosets[photoset_title];
  if (photoset) {
    process.nextTick(function() { callback(photoset); });
  }
  else {
    var data = {title: photoset_title, description: 'flickr-store', primary_photo_id: this.backup_cover_photo.id};
    flickr_client.api('flickr.photosets.create', data, function(err, response) {
      logerr(err);
      flickr_client.api('flickr.photosets.getInfo', {photoset_id: response.photoset.id}, function(err, response) {
        logerr(err);
        var photoset = self.addPhotoset(response.photoset);
        callback(photoset);
      });
    });
  }
};



function FlickrPhotoset(title, raw) {
  // photos is {photo_title: photo_object}
  this.title = title;
  this.raw = raw;

  this.photos = {};
  this.total_pages = 1000;
  this.synced = false;
}
FlickrPhotoset.prototype.addPhoto = function(raw_photo) {
  var title = raw_photo.title,
    photo = this.photos[title] = new FlickrPhoto(title, raw_photo);
  return photo;
};
FlickrPhotoset.prototype.sync = function(callback) {
  // callback signature: ()
  var self = this;
  if (!this.synced) {
    this.syncPhotos(function() {
      self.synced = true;
      callback();
    }, 1);
  }
  else {
    process.nextTick(callback);
  }
};
FlickrPhotoset.prototype.syncPhotos = function(callback, page) {
  // callback signature: ()
  // if (page === undefined) page = 1;
  // page through all the photos, assume the photoset exists
  var self = this;
  flickr_client.api('flickr.photosets.getPhotos', {photoset_id: this.raw.id, page: page}, function(err, response) {
    logerr(err);
    self.total_pages = response.photoset.pages;
    // response.photoset.photo is an array of photo_objects
    response.photoset.photo.forEach(function(raw_photo) {
      self.addPhoto(raw_photo);
    });
    if (page < self.total_pages) {
      self.syncPhotos(callback, page + 1);
    }
    else {
      callback();
    }
  });
};



function FlickrPhoto(title, raw) {
  this.title = title;
  this.raw = raw;
}




function LocalPhoto(title) {
  this.title = title;
  // this.cache_key = 'flickr:' + album + '/' + title;
}
LocalPhoto.prototype.existsInPhotoset = function(photoset_title, database, callback) {
  var self = this;
  // callback signature: (<bool> exists)
  var photoset = database.photosets[photoset_title];
  if (photoset) {
    photoset.sync(function() {
      var photo = photoset.photos[self.title];
      return callback(photo !== undefined);
    });
  }
  else {
    callback(false);
  }
};
LocalPhoto.prototype.upload = function(photoset_title, fullpath, database, callback) {
  var self = this;
  database.getPhotoset(photoset_title, function(photoset) {
    var params = {
      title: self.title, description: 'flickr-store', tags: 'flickr-store',
      is_public: 0, is_friend: 0, is_family: 0, hidden: 2
    };
    var options = {
      method: 'POST',
      file: fs.createReadStream(fullpath, {flags: 'r'})
    };
    flickr_client.api('upload', params, options, function(err, response) {
      if (err) {
        console.error("Could not upload photo: " + self.toString() + ". Error message:");
        console.error(err);
      }
      else {
        var photo_id = response.photoid;
        flickr_client.api('flickr.photosets.addPhoto', {photoset_id: photoset.raw.id, photo_id: photo_id}, function(err, response) {
          flickr_client.api('flickr.photos.getInfo', {photo_id: photo_id}, function(err, response) {
            photoset.addPhoto(response.photo);
            callback();
          });
        });
      }
    });
  });
};
LocalPhoto.prototype.toString = function() {
  return this.title;
};

exports.FlickrDatabase = FlickrDatabase;
exports.LocalPhoto = LocalPhoto;
