import pouchCollate from 'pouchdb-collate';
import TaskQueue from './taskqueue';
import WriteQueue from './WriteQueue';
var collate = pouchCollate.collate;

import engines from './engines/index';
import { extend as extend } from 'js-extend';

import errors from './errors';
import loopPromises from './deps/loopPromises';
var forOf = loopPromises.forOf;

var DEFAULT = engines.default;

var getEngine = function (engine, parent) {
  if (!parent) { parent = DEFAULT; }

  if (engines[engine]) {
    engine = engines[engine];
  }
  return extend({}, parent, engine);
};

var CONFIG = {
  readBuffer: 87,
  writeBuffer: 101,
  engine: Object.create(engines.default),
};


var configureEngine = function (configuration) {
  if (configuration.readBuffer) {
    CONFIG.readBuffer = configuration.readBuffer;
  }
  if (configuration.writeBuffer) {
    CONFIG.writeBuffer = configuration.writeBuffer;
  }

  if (!configuration.engine) { return; }
  CONFIG.engine = getEngine(configuration.engine);
};



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

function queryView(engine, view, opts) {
  return engine.preQuery(view).then(function () {
    return engine.queryView(view, opts);
  }).then(function (results) {
    return engine.postQuery(view, results);
  });
}

function updateView(engine, view) {
  // we want to execute updates in sequence
  return getQueue(view).add(function () {
    return engine.preUpdate(view).then(function () {
      return engine.getLastSeq(view);
    }).then(function (lastSeqDoc) {

      // loading the relevant parts from the engine
      var updatesReader = new engine.UpdatesIterator(
        view, lastSeqDoc.seq, CONFIG.readBuffer
      );
      var mapFun = engine.createMapFunction(view);
      var viewWriter = new WriteQueue(
        engine.writeInView.bind(null, view), CONFIG.writeBuffer
      );

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
      }).then(function () {
        return engine.postUpdate(view);
      });
    });
  });
}


function query(db, fun, opts) {
  var engine = CONFIG.engine;

  if (typeof fun !== 'string') {
    engine = getEngine('temp', engine);
  }

  var view;

  return engine.preAll().then(function () {
    return engine.getViewConfig(db, fun, opts);
  }).then(function (createViewOpts) {
    checkQueryParseError(opts, {
      reduce: createViewOpts.reduce,
      map: createViewOpts.map,
    });

    return engine.createViewStore(createViewOpts);
  }).then(function (viewStore) {
    // Updating the view store and returning the query
    view = viewStore;
    if (opts.stale === 'ok' || opts.stale === 'update_after') {
      return queryView(engine, view, opts).then(function (results) {
        if (opts.stale === 'update_after') {
          process.nextTick(function () {
            updateView(engine, view);
          });
        }
        return Promise.resolve(results);
      });
    } else { // stale not ok
      return updateView(engine, view).then(function () {
        return queryView(engine, view, opts);
      });
    }
  }).then(function (results) {
    return engine.postAll(view, results);
  });
}

var exports = {
  drViewLoaded: true,
  _query: function (fun, options, callback) {
    var db = this;
    query(db, fun, options)
      .then(function (res) { callback(null, res); })
      .catch(function (error) { callback(error); });
  },
  configure: configureEngine,
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}

export default exports;
