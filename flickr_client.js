var fs = require('fs'),
  path = require('path'),
  Flickr = require('flickr').Flickr,
  client;

function readOptions(callback) {
  // callback signature: (err, option_dictionary)
  fs.readFile(path.join(__dirname, '.env'), 'utf8', function(err, text) {
    var opts = {};
    if (!err) {
      text.split(/\n/).forEach(function(line) {
        var line_parts = line.split(/\=/);
        opts[line_parts[0]] = line_parts[1];
      });
    }
    callback(err, opts);
  });
}

function init(callback) {
  // callback signature: (err)
  readOptions(function(err, opts) {
    client = new Flickr(opts.FLICKR_API_KEY, opts.FLICKR_API_SECRET,
      opts.FLICKR_OA_TOKEN, opts.FLICKR_OA_TOKEN_SECRET);
    callback();
  });
}

function api(method_name, data, options, callback) {
  // overloaded as (method_name, data, callback)
  return client.createRequest(method_name, data, true, options, callback).send();
}

exports.init = init;
exports.api = api;