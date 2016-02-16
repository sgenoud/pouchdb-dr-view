import createViewStore from './createViewStore';
import queryView from './queryView';

import UpdatesIterator from './UpdatesIterator';
import createMapFunction from './createMapFunction';
import writeInView from './writeInView';
import partialIndex from './partialIndex';
import getViewConfig from './getViewConfig';


var getLastSeq = function (view) {
  return view.db.get('_local/lastSeq').catch(function (err) {
    /* istanbul ignore if */
    if (err.status !== 404) {
      throw err;
    }
    return {seq: 0};
  });
};

export default {
  name: 'default',

  getViewConfig: getViewConfig,
  createViewStore: createViewStore,

  queryView: queryView,
  getLastSeq: getLastSeq,

  createMapFunction: createMapFunction,
  partialIndex: partialIndex,

  UpdatesIterator: UpdatesIterator,
  writeInView: writeInView,

  preUpdate: function () { return Promise.resolve(); },
  postUpdate: function () { return Promise.resolve(); },

  preQuery: function () { return Promise.resolve(); },
  postQuery: function (view, results) {
    return Promise.resolve(results);
  },

  preAll: function () { return Promise.resolve(); },
  postAll: function (view, results) {
    return Promise.resolve(results);
  },

};
