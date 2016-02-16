import debug from 'debug';
var logger = debug('pouchdb:view');

function WriteQueue (writeFunction, batchSize) {
  this.writeFunction = writeFunction;
  this.batchSize = batchSize || 50;

  this.queue = [];

  this._writePromise = Promise.resolve();
  this._waitingForMore = true;
  this._flushing = false;
}

WriteQueue.prototype.add = function (toAdd) {
  this.queue.push(toAdd);
  this.flush();
};

WriteQueue.prototype.flush = function () {
  if (this.queue.length < this.batchSize && this._waitingForMore) { return; }
  if (this._flushing) { return; }

  this._flushing = true;
  var self = this;
  this._writePromise = this._writePromise.then(this.write.bind(this))
    .then(function () {
      self._flushing = false;
      return self.write();
    });
};

WriteQueue.prototype.write = function () {
  var toWrite = this.queue;
  if (toWrite.length === 0) { return Promise.resolve(); }
  this.queue = [];

  logger('Writting ' + toWrite.length + ' records');
  return Promise.resolve(this.writeFunction(toWrite));
};


WriteQueue.prototype.finished = function () {
  this._waitingForMore = false;
  this.flush();
  return this._writePromise;
};

export default WriteQueue;
