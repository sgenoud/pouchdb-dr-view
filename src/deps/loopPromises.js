import inherits from 'inherits';
import Promise from 'pouchdb/extras/promise';

function StoppedIteration() {
  this.name = 'stop_iteration';
  try {
    Error.captureStackTrace(this, StoppedIteration);
  } catch (e) {}
}
inherits(StoppedIteration, Error);

var PromiseLoop = function (promiseIterator, loopContent, condition) {
  this.promiseIterator = promiseIterator;
  this.loopContent = loopContent;

  this.condition = condition;
};

PromiseLoop.prototype.run = function () {
  var self = this;

  var promise = new Promise(function (resolve, reject) {
    self.resolve = resolve;
    self.reject = reject;
  });

  // For the first iteration we need to make sure that we receive a promise
  var firstResult = this.promiseIterator.next();
  if (!firstResult) {
    return this.resolve();
  }
  firstResult.then(this.innerLoop.bind(this)).catch(this.catchError.bind(this));

  return promise;
};

PromiseLoop.prototype.innerLoop = function (value) {
  if (this.condition && this.condition(value)) { return this.resolve(); }
  this.loopContent(value);
  var next = this.promiseIterator.next();

  if (!next || !next.then) { return this.resolve(); }
  next.then(this.innerLoop.bind(this)).catch(this.catchError.bind(this));
};

PromiseLoop.prototype.catchError = function (error) {
  var self = this;
  if (error instanceof StoppedIteration) {
    return self.resolve();
  }
  return self.reject(error);
};



var forOf = function (promiseIterator, loopContent, condition) {
  // Iterates in the loop via the .next method on the generator
  //
  // Is fullfilled when the iterator returns a non promise, throws
  // a StoppedIteration or the condition evaluates to true
  //
  // We need the StoppedIteration error in case we only know that the iteration
  // has stopped only when the promise is fullfilled

  var loop = new PromiseLoop(promiseIterator, loopContent, condition);
  return loop.run();
};

export { forOf, StoppedIteration };
export default {
  forOf: forOf,
  StoppedIteration: StoppedIteration,
};
