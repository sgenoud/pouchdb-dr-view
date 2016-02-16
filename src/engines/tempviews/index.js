import createMapFunction from './createMapFunction';
import createViewStore from './createViewStore';

export default {

  getViewConfig: function (db, fun) {
    return Promise.resolve({
      db: db,
      viewName: 'temp_view/temp_view',
      map: fun.map,
      reduce: fun.reduce,
    });
  },

  createViewStore: createViewStore,

  postAll: function (view, results) {
    return view.db.destroy().then(function () {
      return Promise.resolve(results);
    });
  },

  createMapFunction: createMapFunction,
};
