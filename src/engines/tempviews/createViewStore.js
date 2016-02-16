import upsert from '../../deps/upsert';
import { v4 as uuid } from 'uuid';

export default function (opts) {
  var sourceDB = opts.db;
  var viewName = opts.viewName;
  var mapFun = opts.map;
  var reduceFun = opts.reduce;

  return sourceDB.info().then(function (info) {

    var depDbName = info.db_name + '-mrview-temp-' + uuid();

    // save the view name in the source db so it can be cleaned up if
    // necessary (e.g. when the _design doc is deleted, remove all associated
    // view data)

    function diffFunction(doc) {
      doc.views = doc.views || {};
      var fullViewName = viewName;
      if (fullViewName.indexOf('/') === -1) {
        fullViewName = viewName + '/' + viewName;
      }
      var depDbs = doc.views[fullViewName] = doc.views[fullViewName] || {};
      /* istanbul ignore if */
      if (depDbs[depDbName]) {
        return; // no update necessary
      }
      depDbs[depDbName] = true;
      return doc;
    }

    return upsert(sourceDB, '_local/mrviews', diffFunction).then(function () {
      var dbIsRegistered = sourceDB.registerDependentDatabase(depDbName);
      return dbIsRegistered.then(function (res) {
        var db = res.db;
        db.auto_compaction = true;
        return {
          name: depDbName,
          db: db,
          sourceDB: sourceDB,
          adapter: sourceDB.adapter,
          mapFun: mapFun,
          reduceFun: reduceFun,
        };
      });
    });
  });
}
