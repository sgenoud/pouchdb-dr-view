## Dr View - it is time for Mr View to graduate

DrView is a framework aimed at making the development of native view engines
(and other experiments with view improvements) easier.

By default views are implemented on top of couch itself. With DrView you can
swap different pieces as you wish.

In order to register a new engine you first need to have DrView loaded as
a PouchDB plugin:

```
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-drview'));
```

By default it uses a refactor of the standard mrview of pouchdb.

You can use another engine if you want to:

```
PouchDB.configureViewEngine({engine: myEngineObject})
```

Where `myEngineObject` overrides some (or all) of the view engine API methods.

Note that you can also configure the read and write buffers as well:

```
PouchDB.configureViewEngine({
  readBuffer: 87,
  writeBuffer: 101,
})
```

Some logging has been added via the `debug` module, within the `pouchdb:view`
namespace.


##### View Engine API

**This is a work in progress and should evolve**

Note that unless specified otherwise these functions return Promises. 

###### Database creation and state

* `getViewConfig`: should be changed
* `createViewStore`: should be changed
* `getLastSeq`: returns an object `{seq: 33}` which is the last sequence
  processed in the database read.


###### Query API

The query API has not been refactored at all from the standard API, there is
just one method

* `queryView(view, options)`: the promise should resolve to the response to the
  query.


###### Updates API

* `UpdatesIterator`: A class that implements a modified version of the Iterator
  protocol. The object will be instantiated with the `view`, then a `next`
  method must be implemented. This should return the next update (single
  update document) in a Promise. In order to signify the end of the iteration,
  it must throw a `StoppedIteration` error (this is the difference with the
  standard Iterator protocol).

* `createMapFunction(view)`: Returns a function that takes a doc a argument and
  returns an array of emitted objects.
* `partialIndex(emitted)`: takes the object emitted from the map function and
  transforms it into what needs to be inserted in the index.

* `writeInView(view, batch)`: Takes a batch of updates and write them in the
  View (whatever that is). Return a Promise on completion only. Is also
  responsible for writing the sequence (this should be moved somewhere else).



###### Additional hooks

There are some additional hooks that might be useful for your particular
implementation:

* `preAll()`
* `postAll(view, results)`: The promise resolved should resolve to `results`

* `preUpdate(view)`
* `postUpdate(view)`

* `preQuery(view)`
* `postQuery(view, results)`: The promise resolved should resolve to `results`

