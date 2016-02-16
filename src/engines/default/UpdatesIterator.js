import loopPromises from '../../deps/loopPromises';
var StoppedIteration = loopPromises.StoppedIteration;
import Promise from 'pouchdb/extras/promise';


import debug from 'debug';
var logger = debug('pouchdb:view');


function getBatch(view, currentSeq, batchSize) {
  return new Promise(function (resolve, reject) {
    view.sourceDB.changes({
      conflicts: true,
      include_docs: true,
      style: 'all_docs',
      since: currentSeq,
      limit: batchSize,
    }).on('complete', function (response) {
      logger('Batch fetched');
      resolve({
        values: response.results,
        lastSeq: response.results.length && response.results.slice(-1)[0].seq,
      });
    }).on('error', function (err) {
      reject(err);
    });
  });
}

function UpdatesIterator (view, startSeq, batchSize) {
  this.currentSeq = startSeq || 0;
  this.fetchedData = [];
  this.hasMoreData = true;
  this.view = view;

  this.batchSize = batchSize || 50;

  this.nextBatch = null;
}
UpdatesIterator.prototype.next = function () {
  var self = this;
  if (!this.nextBatch) {
    this.fetchFurther();
  }

  if (this.fetchedData.length) {
    return Promise.resolve(self.fetchedData.shift());
  }
  if (!this.fetchedData.length && !this.hasMoreData) {
    return Promise.reject(new StoppedIteration());
  }

  return this.nextBatch.then(function () {
    if (!self.fetchedData.length) {
      return Promise.reject(new StoppedIteration());
    }
    return Promise.resolve(self.fetchedData.shift());
  });
};

UpdatesIterator.prototype.fetchFurther = function () {
  var self = this;
  this.nextBatch = getBatch(this.view, this.currentSeq, this.batchSize)
    .then(function (batch) {
      if (!batch.values.length) {
        self.hasMoreData = false;
      }

      self.currentSeq = batch.lastSeq;
      self.fetchedData = self.fetchedData.concat(batch.values);

      if (self.hasMoreData) {
        self.fetchFurther();
      }

      return Promise.resolve();
    });
};

export default UpdatesIterator;
