#!/usr/bin/env node
var path = require('path');
var glob = require('glob');
var argv = require('optimist').default('workers', 10).argv;
var events = require('events');
var util = require('util');
var async = require('async');
// require('long-stack-traces');

var flickr_client = require('./flickr_client');
var models = require('./models');

var img_regex = /(png|jpg|jpeg)/i;

function logerr(err) {
  if (err) {
    console.log('flick-backup error:', err);
    throw err;
  }
}

flickr_client.init(function(err) {
  logerr(err);

  // 1. get the backup-cover-photo (silly Flickr requirement)
  flickr_client.api('flickr.photos.search', {user_id: 'me', tags: 'api'}, function(err, response) {
    logerr(err);
    console.log('Using backup_cover_photo:', response.photos.photo[0].id);

    // 2. get the list of all the photos we want to add
    glob('*/*.jpg', {cwd: argv.dir, nocase: true}, function (err, files) {
      var total = files.length;
      console.log('Queueing up ' + total + ' files.');

      var albums = {};
      files.forEach(function(file, index) {
        file.index = index;
        albums[file.split(/\//)[0]] = 1;
      });
      var album_names = Object.keys(albums);

      var flickr_database = new models.FlickrDatabase(response.photos.photo[0]);
      flickr_database.init(album_names, function() {
        console.log('Preloaded albums:', album_names.join(', '));

        async.eachLimit(files, argv.workers, function(file, finished) {
          var fullpath = path.join(argv.dir, file);
          var file_parts = file.split(/\//);
          var photoset_title = file_parts[0];
          var photo_title = file_parts[1];
          var local_photo = new models.LocalPhoto(photo_title);

          var name = '(' + file.index + '/' + total + ') ' + local_photo.title;
          local_photo.existsInPhotoset(photoset_title, flickr_database, function(exists) {
            if (exists) {
              console.log(name + ' already exists in ' + photoset_title);
              finished();
            }
            else {
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
        }, function() {
          console.log('No more photos could be found!');
          process.exit();
        });
      });
    });
  });
});

// process.on('uncaughtException', function(err) {
//   if (err && err.stack) {
//     console.log('uncaughtException: ' + err.toString());
//     console.log(err.stack);
//   }
//   else {
//     console.log('uncaughtException for null/stackless error.');
//     console.log(util.inspect(err, {showHidden: true, depth: 10}));
//   }
//   // var stack = new Error().stack
//   // console.log( stack )
//   console.trace();
//   process.exit();
// });
