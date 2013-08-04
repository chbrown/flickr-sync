'use strict'; /*jslint es5: true, node: true, indent: 2 */
var async = require('async');
var stream = require('stream');
var util = require('util');
var models = require('./models');
var logger = require('winston');

// mostly copy & pasted directly from Twilight. I'll modularize it sometime.
var LineStream = module.exports.LineStream = function() {
  stream.Transform.call(this, {decodeStrings: true});
  this._writableState.objectMode = false;
  this._readableState.objectMode = true;
};
util.inherits(LineStream, stream.Transform);
LineStream.prototype._chunk = function(buffer, encoding) {
  if (encoding == 'buffer' || encoding === undefined) encoding = 'utf8';
  var chunk = buffer.toString(encoding);
  this.push(chunk);
};
LineStream.prototype._transform = function(chunk, encoding, callback) {
  // assert encoding == 'buffer'
  var buffer = (this._buffer && this._buffer.length) ? Buffer.concat([this._buffer, chunk]) : chunk;
  var start = 0;
  var end = buffer.length;
  for (var i = 0; i < end; i++) {
    if (buffer[i] === 13 || buffer[i] === 10) {
      this._chunk(buffer.slice(start, i), encoding);
      if (buffer[i] === 13 && buffer[i + 1] === 10) { // '\r\n'
        i++;
      }
      start = i + 1;
    }
  }
  this._buffer = buffer.slice(start);
  callback();
};
LineStream.prototype._flush = function(callback) {
  if (this._buffer && this._buffer.length) {
    this._chunk(this._buffer);
  }
  callback();
};

exports.sync = function(api, directory, workers, callback) {
  var flickr_database = new models.FlickrDatabase(api);
  flickr_database.initialize(function(err) {
    if (err) throw err;
    var upload_queue = async.queue(function(local_photo, callback) {
      // var name = '(' + local_photo.index + '/' + total + ') ' + local_photo.title;
      // flickr_database.getPhotoset checks the local cache and hits the Flickr API as needed.
      flickr_database.getPhotoset(local_photo.album, function(err, photoset) {
        if (err) {
          logger.error(err);
        }
        else {
          var photo = photoset.getPhoto(local_photo.name);
          if (photo) {
            logger.warn('%s already exists in %s', local_photo.name, local_photo.album);
            callback();
          }
          else {
            photoset.upload(local_photo, function(err) {
              if (!err) {
                logger.info('%s uploaded to %s', local_photo.name, local_photo.album);
              }
              else {
                logger.error('Failed to upload %s to %s', local_photo.name, local_photo.album, err);
              }
              callback(err);
            });
          }
        }
      });
    }, workers);

    upload_queue.drain = function() {
      logger.debug('Upload queue is drained; all photos have been processed.');
      callback();
      // process.exit();
    };

    models.LocalPhoto.stream(directory)
    .on('error', function(err) {
      logger.debug('Local photo stream', err);
    })
    .on('data', function(local_photo) {
      upload_queue.push(local_photo, function(err) {
        logger.debug('Queue finished with photo', local_photo);
      });
    })
    .on('end', function() {
      logger.info('Added photos to the queue.');
    });
  });
};
