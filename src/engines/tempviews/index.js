import TaskQueue from '../taskqueue';
var tempViewQueue = new TaskQueue();

var query = function (db, fun, opts) {
  checkQueryParseError(opts, fun);

  var createViewOpts = {
    db: db,
    viewName: 'temp_view/temp_view',
    map: fun.map,
    reduce: fun.reduce,
    temporary: true,
  };

  tempViewQueue.add(function () {
    return createView(createViewOpts).then(function (view) {
      function cleanup() {
        return view.db.destroy();
      }
      return fin(updateView(view).then(function () {
        return queryView(view, opts);
      }), cleanup);
    });
  });

  return tempViewQueue.finish();
};

export default {
  query: query,
};

