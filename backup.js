#!/usr/bin/env node
var path = require('path'),
  glob = require('glob'),
  flickr_client = require('./flickr_client'),
  models = require('./models'),
  img_regex = /(png|jpg|jpeg)/i,
  argv = require('optimist').argv;

function logerr(err) { if (err) console.log("ERR", err); }

function WorkerPool(max_workers, work) {
  this.workers = 0;
  this.max_workers = max_workers;
  // `work` should be a function that takes one argument, a callback function for when it's finished.
  this.work = work;
}
WorkerPool.prototype.bump = function() {
  while (this.workers < this.max_workers) {
    this.manage();
  }
};
WorkerPool.prototype.manage = function() {
  var self = this;
  this.workers++;
  this.work(function() {
    self.workers--;
    self.bump();
  });
};

flickr_client.init(function(err) {
  if (err) console.error(err);

  // 1. get the backup-cover-photo (silly Flickr requirement)
  flickr_client.api("flickr.photos.search", {user_id: 'me', text: 'flickr-store', tags: 'api'}, function(err, response) {
    logerr(err);
    console.log("Using backup_cover_photo:", response.photos.photo[0].id);
    // process.exit(999);

    var directory = argv.dir,
      flickr_database = new models.FlickrDatabase(response.photos.photo[0]);
    flickr_database.init(function() {
      // 2. get the list of all the photos we want to add
      glob('*/*.jpg', {cwd: directory}, function (err, files) {
        // var queue = files.map(function(file) {
        //   return new LocalPhoto(file_parts[0], file_parts[1], fullpath);
        // });

        var work = function(callback) {
          var file = files.shift();

          // check the exit condition:
          if (file === undefined) {
            console.log("No more photos could be found!");
            process.exit();
          }
          
          var fullpath = path.join(directory, file),
            file_parts = file.split(/\//),
            photoset_title = file_parts[0],
            photo_title = file_parts[1],
            local_photo = new models.LocalPhoto(photo_title);

          local_photo.existsInPhotoset(photoset_title, flickr_database, function(exists) {
            if (exists) {
              console.log("Photo already exists in Flickr:", local_photo.toString());
              callback();
            }
            else {
              // console.log("Photo already exists in Flickr");
              local_photo.upload(photoset_title, fullpath, flickr_database, function() {
                console.log("Photo uploaded to Flickr:", local_photo.toString());
                callback();
              });
            }
          });
        };

        var pool = new WorkerPool(1, work);
        pool.bump();
      });
    });
  });
});

