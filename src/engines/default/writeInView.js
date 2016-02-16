import Promise from 'pouchdb/extras/promise';
import utils from '../../utils';
var defaultsTo = utils.defaultsTo;

import debug from 'debug';
var logger = debug('pouchdb:view');

var lastSeqDocToSave = function (view, batch) {
  var newSeq = batch.slice(-1)[0].update.seq;

  var seqDocId = '_local/lastSeq';
  return view.db.get(seqDocId)
    .catch(defaultsTo({_id: seqDocId, seq: 0}))
    .then(function (lastSeqDoc) {
      lastSeqDoc.seq = newSeq;
      return Promise.resolve(lastSeqDoc);
    });
};

function isGenOne(changes) {
  // only return true if the current change is 1-
  // and there are no other leafs
  return changes.length === 1 && /^1-/.test(changes[0].rev);
}
var queryMetadata = function queryMetadata(view, updates) {
  // Metadata contains a document that stores the relationship document => key
  // in the index

  var metadataByDocId = {};
  var metadataToFetch = [];

  updates.forEach(function (update) {
    var docId = update.update.id;
    var metaDocId = '_local/doc_' + docId;

    if (isGenOne(update.update.changes)) {
      metadataByDocId[docId] = {_id: metaDocId, keys: []};
    } else {
      metadataToFetch.push(view.db.get(metaDocId).catch(defaultsTo({
        _id: metaDocId, keys: [],
      })));
    }
  });

  if (!metadataToFetch.length) {
    return Promise.resolve(metadataByDocId);
  }

  return Promise.all(metadataToFetch).then(function (results) {
    results.forEach(function (doc) {
      metadataByDocId[doc._id.slice(11)] = doc;
    });

    return Promise.resolve(metadataByDocId);
  });
};

var queryPartialIndex = function queryIndexByDocIds(view, metadataByDocId) {
  // Returns the partial index corresponding to the current metadata retrieved
  var allKeys = [];

  Object.keys(metadataByDocId).forEach(function(docId) {
    if (metadataByDocId[docId].keys && metadataByDocId[docId].keys.length) {
      allKeys = allKeys.concat(metadataByDocId[docId].keys);
    }
  });

  if (!allKeys.length) {
    return Promise.resolve({});
  }
  return view.db.allDocs({
    keys: allKeys,
    include_docs: true,
  }).then(function (viewValues) {
    var partialIndex = {};
    viewValues.rows.forEach(function (viewValue) {
      partialIndex[viewValue.id] = viewValue.doc;
    });
    return Promise.resolve(partialIndex);
  });
};

var queryState = function queryState (view, updates) {
  var state = {};
  return queryMetadata(view, updates).then(function (metadataByDocId) {
    state.metadataByDocId = metadataByDocId;
    return queryPartialIndex(view, metadataByDocId);
  }).then(function (partialIndex) {
    state.partialIndex = partialIndex;
    return Promise.resolve(state);
  });
};


export default function (view, batch) {

  return Promise.all([
    queryState(view, batch),
    lastSeqDocToSave(view, batch),
  ]).then(function (results) {
    var dbState = results[0];
    var lastSeqDocToSave = results[1];

    var dbChanges = [lastSeqDocToSave];

    batch.forEach(function (update) {

      var newKeys = Object.keys(update.newPartialIndex);
      newKeys.forEach(function (key) {
        var indexChange = update.newPartialIndex[key];
        if (dbState.partialIndex[key]) {
          indexChange._rev = dbState.partialIndex[key]._rev;
          delete dbState.partialIndex[key];
        }

        indexChange._id = key;
        dbChanges.push(indexChange);
      });

      var metadata = dbState.metadataByDocId[update.docId];
      metadata.keys = newKeys;

      dbChanges.push(metadata);
    });

    Object.keys(dbState.partialIndex).forEach(function (key) {
      var toDelete = dbState.partialIndex[key];
      toDelete._deleted = true;
      dbChanges.push(toDelete);
    });

    logger('Writing on db');
    return view.db.bulkDocs({docs: dbChanges}).then(function (res) {
      logger('Written on db');

      return Promise.resolve();
    });
  });

}
