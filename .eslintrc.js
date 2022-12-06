/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

// enforces copyright header to be present in every file
// eslint-disable-next-line max-len

module.exports = {
  extends: ["eslint:recommended", "prettier"],
  plugins: [
    "flowtype"
  ],
  env: {
    es6: true,
    node: true,
  },
  parser: "babel-eslint",
  parserOptions: {
    sourceType: "module",
  },
  rules: {
    // we want to force semicolons
    semi: ["error", "always"],
    // we use 2 spaces to indent our code
    indent: ["error", 2],
    // we want to avoid useless spaces
    "no-multi-spaces": ["error"]
  },
};
