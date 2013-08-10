'use strict'; /*jslint es5: true, node: true, indent: 2 */
var logger = require('winston');
var path = require('path');
var streaming = require('streaming');

var models = require('./models');

exports.sync = function(api, directory, workers, callback) {
  var flickr_database = new models.FlickrDatabase(api);
  flickr_database.initialize(function(err) {
    if (err) return callback(err);

    var worker = function(local_photo, callback) {
      // flickr_database.getPhotoset checks the local cache and hits the Flickr API as needed.
      // as per the streaming.Queue API, this must ALWAYS be truly async.
      flickr_database.getPhotoset(local_photo.album, function(err, photoset) {
        if (err) {
          logger.error('getPhotoset error: %s', local_photo.album, err);
          return callback(err);
        }

        var photo = photoset.photos[local_photo.name];
        if (photo) {
          logger.info('%s already exists in %s', local_photo.name, local_photo.album);
          callback();
        }
        else {
          logger.debug('Did not find photo named "%s" in photoset "%s", uploading.',
            local_photo.name, local_photo.album);
          photoset.upload(local_photo, function(err) {
            if (!err) {
              logger.info('%s uploaded to %s', local_photo.name, local_photo.album);
            }
            else {
              logger.error('Failed to upload photo "%s" to photoset "%s"',
                local_photo.name, local_photo.album, err);
              logger.warn('Retrying (writing local photo back to queue stream)');
              queue_stream.write(local_photo);
            }
            // don't report error, even if there is one
            callback();
          });
        }
      });
    };

    var glob_stream = new streaming.Glob('*/*.{gif,png,jpg,jpeg,tif,tiff}', {cwd: directory, nocase: true})
    .on('error', function(err) { throw err; })
    .on('end', function() {
      logger.debug('Globbed all files from subfolders.');
    });

    var photo_stream = new streaming.Mapper(function(match) {
      var album = path.dirname(match);
      var photo = path.basename(match);
      return new models.LocalPhoto(album, photo, path.join(directory, match));
    })
    .on('error', function(err) { throw err; })
    .on('end', function() {
      logger.info('Added photos to the queue.');
    });

    var queue_stream = new streaming.Queue(20, worker)
    .on('error', function(err) { throw err; })
    .on('end', function() {
      logger.info('Upload queue is drained.');
      callback();
    });

    glob_stream.pipe(photo_stream).pipe(queue_stream);
  });
};
