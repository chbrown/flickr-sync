#!/usr/bin/env node
var path = require('path');
var glob = require('glob');
var argv = require('optimist').default('workers', 10).argv;
var events = require('events');
var util = require('util');
var async = require('async');

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
      var local_photos = files.map(function(file, index) {
        var file_parts = file.split(/\//);
        var local_photo = new models.LocalPhoto(file_parts[1],
          file_parts[0], path.join(argv.dir, file));

        local_photo.index = index;
        albums[local_photo.photoset_title] = 1;
        return local_photo;
      });
      var album_names = Object.keys(albums);

      var flickr_database = new models.FlickrDatabase(response.photos.photo[0]);
      flickr_database.init(album_names, function() {
        console.log('Preloaded albums:', album_names.join(', '));

        async.eachLimit(local_photos, argv.workers, function(local_photo, finished) {

          var name = '(' + local_photo.index + '/' + total + ') ' + local_photo.title;
          local_photo.existsInPhotoset(local_photo.photoset_title, flickr_database, function(exists) {
            if (exists) {
              console.log(name + ' already exists in ' + local_photo.photoset_title);
              finished();
            }
            else {
              local_photo.upload(local_photo.photoset_title, local_photo.fullpath, flickr_database, function(err) {
                if (err) {
                  console.error('Failed uploading ' + name + ' to ' + local_photo.photoset_title + '. Error message:');
                  console.error(err);
                }
                else {
                  console.log(name + ' uploaded to ' + local_photo.photoset_title);
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
