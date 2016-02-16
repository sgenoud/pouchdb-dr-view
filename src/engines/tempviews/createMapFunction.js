import pouchCollate from 'pouchdb-collate';
var normalizeKey = pouchCollate.normalizeKey;

import evalFunc from '../../evalfunc';
import utils from '../../utils';

var sum = utils.sum;
var log = utils.log;
var tryCode = utils.tryCode;

var createMapFunction = function (view) {
  var mapResults = [];

  function emit(key, value) {
    var output = {key: normalizeKey(key)};
    // Don't explicitly store the value unless it's defined and non-null.
    // This saves on storage space, because often people don't use it.
    if (typeof value !== 'undefined' && value !== null) {
      output.value = normalizeKey(value);
    }
    mapResults.push(output);
  }

  var mapFun;
  // for temp_views one can use emit(doc, emit), see #38
  if (typeof view.mapFun === 'function' && view.mapFun.length === 2) {
    var origMap = view.mapFun;
    mapFun = function (doc) {
      return origMap(doc, emit);
    };
  } else {
    mapFun = evalFunc(view.mapFun.toString(), emit, sum, log, Array.isArray,
      JSON.parse);
  }

  return function (doc) {
    mapResults = [];
    tryCode(view.sourceDB, mapFun, [doc]);
    return mapResults.map(function (emitted) {
      emitted.id = doc._id;
      return emitted;
    });
  };

};

export default createMapFunction;
