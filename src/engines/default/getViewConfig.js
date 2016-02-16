import errors from '../../errors';
import utils from '../../utils';
var parseViewName = utils.parseViewName;


export default function (db, fun) {
  var fullViewName = fun;
  var parts = parseViewName(fullViewName);
  var designDocName = parts[0];
  var viewName = parts[1];

  return db.get('_design/' + designDocName).then(function (doc) {
    var fun = doc.views && doc.views[viewName];

    if (!fun || typeof fun.map !== 'string') {
      throw new errors.NotFoundError('ddoc ' + designDocName +
      ' has no view named ' + viewName);
    }

    return Promise.resolve({
      db: db,
      viewName: fullViewName,
      map: fun.map,
      reduce: fun.reduce,
    });
  });
}

