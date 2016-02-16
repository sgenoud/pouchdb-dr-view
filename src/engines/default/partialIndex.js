import pouchCollate from 'pouchdb-collate';
var toIndexableString = pouchCollate.toIndexableString;
var collate = pouchCollate.collate;

function sortByKeyThenValue(x, y) {
  var keyCompare = collate(x.key, y.key);
  return keyCompare !== 0 ? keyCompare : collate(x.value, y.value);
}

function generatePartialIndex (emitted) {
  emitted.sort(sortByKeyThenValue);
  var indexableKeysToKeyValues = {};
  var lastKey;
  for (var j = 0, jl = emitted.length; j < jl; j++) {
    var obj = emitted[j];
    var complexKey = [obj.key, obj.id];
    if (collate(obj.key, lastKey) === 0) {
      complexKey.push(j); // dup key+id, so make it unique
    }
    var indexableKey = toIndexableString(complexKey);
    indexableKeysToKeyValues[indexableKey] = obj;
    lastKey = obj.key;
  }
  return indexableKeysToKeyValues;
}

export default generatePartialIndex;
