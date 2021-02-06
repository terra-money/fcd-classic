#!/usr/bin/env sh

# run mergeswagger at runtime
# merge from lcd, so depends on runtime env/network
npm run apidoc
npm run mergeswagger -- -o swagger.json

exec npm run "$@"
