import pouchCollate from 'pouchdb-collate';
import TaskQueue from './taskqueue';
import WriteQueue from './WriteQueue';
var collate = pouchCollate.collate;

import engines from './engines/index';
var viewEngines = {};

import utils from './utils';
var parseViewName = utils.parseViewName;

import debug from 'debug';
var logger = debug('pouchdb:view');

import errors from './errors';
import loopPromises from './deps/loopPromises';
var forOf = loopPromises.forOf;

function checkPositiveInteger(number) {
  if (number) {
    if (typeof number !== 'number') {
      return new errors.QueryParseError('Invalid value for integer: "' +
      number + '"');
    }
    if (number < 0) {
      return new errors.QueryParseError('Invalid value for positive integer: ' +
        '"' + number + '"');
    }
  }
}
function checkQueryParseError(options, fun) {
  var startkeyName = options.descending ? 'endkey' : 'startkey';
  var endkeyName = options.descending ? 'startkey' : 'endkey';

  if (typeof options[startkeyName] !== 'undefined' &&
    typeof options[endkeyName] !== 'undefined' &&
    collate(options[startkeyName], options[endkeyName]) > 0) {
    throw new errors.QueryParseError('No rows can match your key range, ' +
    'reverse your start_key and end_key or set {descending : true}');
  } else if (fun.reduce && options.reduce !== false) {
    if (options.include_docs) {
      throw new errors.QueryParseError(
        '{include_docs:true} is invalid for reduce'
      );
    } else if (options.keys && options.keys.length > 1 &&
        !options.group && !options.group_level) {
      throw new errors.QueryParseError(
        'Multi-key fetches for reduce views must use {group: true}'
      );
    }
  }
  ['group_level', 'limit', 'skip'].forEach(function (optionName) {
    var error = checkPositiveInteger(options[optionName]);
    if (error) {
      throw error;
    }
  });
}

var persistentQueues = {};
function getQueue(view) {
  var viewName = typeof view === 'string' ? view : view.name;
  var queue = persistentQueues[viewName];
  if (!queue) {
    queue = persistentQueues[viewName] = new TaskQueue();
  }
  return queue;
}

function updateView(engine, view) {

  // we want to execute updates in sequence
  return getQueue(view).add(function () {
    return engine.getLastSeq(view).then(function (lastSeqDoc) {

      // loading the relevant parts from the engine
      var updatesReader = new engine.UpdatesIterator(view, lastSeqDoc.seq, 87);
      var mapFun = engine.createMapFunction(view);
      var viewWriter = new WriteQueue(engine.writeInView.bind(engine, view), 101);

      return forOf(updatesReader, function (update) {
        var docId = update.doc._id;
        if (docId[0] === '_') { return; }

        var emitted = [];
        if (!update.doc._deleted) {
          emitted = mapFun(update.doc);
        }
        var partialIndex = engine.partialIndex(emitted);

        viewWriter.add({
          docId: update.doc._id,
          update: update,
          newPartialIndex: partialIndex,
        });

      }).then(function () {
        // Wait for everything to be written down;
        return viewWriter.finished();
      });
    });
  });
}


function query(db, fun, opts) {
  var fullViewName = fun;
  var parts = parseViewName(fullViewName);
  var designDocName = parts[0];
  var viewName = parts[1];

  var engine = engines.default;

  return db.get('_design/' + designDocName).then(function (doc) {
    var fun = doc.views && doc.views[viewName];

    if (!fun || typeof fun.map !== 'string') {
      throw new errors.NotFoundError('ddoc ' + designDocName +
      ' has no view named ' + viewName);
    }
    checkQueryParseError(opts, fun);

    var createViewOpts = {
      db: db,
      viewName: fullViewName,
      map: fun.map,
      reduce: fun.reduce,
    };
    return engine.createViewStore(createViewOpts).then(function (view) {
      if (opts.stale === 'ok' || opts.stale === 'update_after') {
        if (opts.stale === 'update_after') {
          process.nextTick(function () {
            updateView(engine, view);
          });
        }
        return engine.queryView(view, opts);
      } else { // stale not ok
        return updateView(engine, view).then(function () {
          logger('query view');
          return engine.queryView(view, opts);
        });
      }
    });
  });
}

var exports = {
  drViewLoaded: true,
  _query: function (fun, options, callback) {
    var db = this;
    query(db, fun, options)
      .then(function (res) {
        callback(null, res);
      })
      .catch(function (error) {
        callback(error);
      });
  },
  registerViewEngine: function (id, engine) {
    viewEngines[id] = engine;
  },
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}

export default exports;
