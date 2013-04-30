#!/usr/bin/env node
var path = require('path');
var glob = require('glob');
var argv = require('optimist').argv;

var flickr_client = require('./flickr_client');
var models = require('./models');

var img_regex = /(png|jpg|jpeg)/i;

function logerr(err) { if (err) console.log("ERR", err); }

function WorkerPool(max_workers, work) {
  var self = this;
  this.workers = 0;
  this.max_workers = max_workers;
  // `work` should be a function that takes one argument, a callback function for when it's finished.
  this.work = work;
  this.workCallback = function() {
    self.workers--;
    self.bump();
  };
}
WorkerPool.prototype.bump = function() {
  while (this.workers < this.max_workers) {
    this.workers++;
    this.work(this.workCallback);
  }
};

flickr_client.init(function(err) {
  logerr(err);

  // 1. get the backup-cover-photo (silly Flickr requirement)
  flickr_client.api("flickr.photos.search", {user_id: 'me', tags: 'api'}, function(err, response) {
    logerr(err);
    console.log("Using backup_cover_photo:", response.photos.photo[0].id);

    // 2. get the list of all the photos we want to add
    glob('*/*.jpg', {cwd: argv.dir, nocase: true}, function (err, files) {
      var total = files.length;
      console.log("Queueing up " + total + " files.");

      var albums = {};
      files.forEach(function(file) { albums[file.split(/\//)[0]] = 1; });

      var flickr_database = new models.FlickrDatabase(response.photos.photo[0]);
      flickr_database.init(Object.keys(albums), function() {
        console.log("Preloaded albums:", Object.keys(albums).join(', '));
        var work = function(finished) {
          var file = files.shift();

          // check the exit condition:
          if (file === undefined) {
            console.log("No more photos could be found!");
            process.exit();
          }

          try {
            var fullpath = path.join(argv.dir, file);
            var file_parts = file.split(/\//);
            var photoset_title = file_parts[0];
            var photo_title = file_parts[1];
            var local_photo = new models.LocalPhoto(photo_title);

            local_photo.existsInPhotoset(photoset_title, flickr_database, function(exists) {
              var name = '(' + (total - files.length) + '/' + total + ') ' + local_photo.title;
              if (exists) {
                console.log(name + ' already exists in ' + photoset_title);
                finished();
              }
              else {
                // console.log("Photo already exists in Flickr");
                local_photo.upload(photoset_title, fullpath, flickr_database, function(err) {
                  if (err) {
                    console.error('Failed uploading ' + name + ' to ' + photoset_title + '. Error message:');
                    console.error(err);
                  }
                  else {
                    console.log(name + ' uploaded to ' + photoset_title);
                  }
                  finished();
                });
              }
            });
          }
          catch (exc) {
            console.error('Encountered some error, printing and continuing');
            console.error(exc.toString());
          }
        };

        var max_workers = parseInt(argv.workers || 10, 10);
        console.log('Starting work with ' + max_workers + ' workers.');
        var pool = new WorkerPool(max_workers, work);
        pool.bump();
      });
    });
  });
});

