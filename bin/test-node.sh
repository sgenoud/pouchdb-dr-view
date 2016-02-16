#!/bin/bash

: ${TIMEOUT:=50000}
: ${REPORTER:="spec"}
: ${BAIL:=1}

if [ $BAIL -eq 1 ]; then
    BAIL_OPT="--bail"
else
    BAIL_OPT=""
fi

TESTS_PATH="tests/mapreduce/test.*.js"
if [ $COVERAGE ]; then
    # run all tests when testing for coverage
    TESTS_PATH="tests/{mapreduce}/test*.js"
fi


if [ ! $COVERAGE ]; then
    ./node_modules/.bin/mocha \
        $BAIL_OPT \
        --timeout $TIMEOUT \
        --require=./tests/node.setup.js \
        --reporter=$REPORTER \
        --grep=$GREP \
        $TESTS_PATH
else
    ./node_modules/.bin/istanbul cover ./node_modules/mocha/bin/_mocha -- \
        $BAIL_OPT \
        --timeout $TIMEOUT \
        --require=./tests/node.setup.js \
        --reporter=$REPORTER \
        --grep=$GREP \
        $TESTS_PATH
fi

