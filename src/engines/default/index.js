import createViewStore from './createViewStore';
import queryView from './queryView';

import UpdatesIterator from './UpdatesIterator';
import createMapFunction from './createMapFunction';
import writeInView from './writeInView';
import partialIndex from './partialIndex';


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
  createViewStore: createViewStore,
  queryView: queryView,
  UpdatesIterator: UpdatesIterator,

  getLastSeq: getLastSeq,

  createMapFunction: createMapFunction,
  writeInView: writeInView,
  partialIndex: partialIndex,
};
