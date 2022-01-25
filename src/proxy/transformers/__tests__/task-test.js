/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import tasks from '../task';
import {findTransformerFx, mockRequest} from './metadata-workflowdef-test';
import {mockIdentity} from "./metadata-workflowdef-rbac-test";
import streamToString from "stream-to-string";
import {createProxyOptionsBuffer} from "../../utils";

describe('Task transformers', () => {

  const transformers = tasks({"proxyTarget": "PROXY_TARGET"});

  test("GET task before", () => {
    const transformer = findTransformerFx(transformers, "/api/tasks/poll/:taskType", "get", "before");

    let mockReq = mockRequest({}, {"taskType": "testTask"}, {'from': "a@fb.com"},);
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };

      transformer(mockIdentity("FACEBOOK", ["network-admin"], []), mockReq,
        null,
        callback);

    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/tasks/poll/FACEBOOK___testTask?domain=FACEBOOK");
    });
  });

  test("GET task before with additional params", () => {
    const transformer = findTransformerFx(transformers, "/api/tasks/poll/:taskType", "get", "before");

    let mockReq = mockRequest({}, {"taskType": "testTask"}, {'from': "a@fb.com"}, {'query': "workerid=abcd&domain=DOM"});
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };

      transformer(mockIdentity("FACEBOOK", ["network-admin"], []), mockReq,
        null,
        callback);

    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/tasks/poll/FACEBOOK___testTask?workerid=abcd&domain=FACEBOOK");
    });
  });

  test("GET tasks batch before with additional params", () => {
    const transformer = findTransformerFx(transformers, "/api/tasks/poll/batch/:taskType", "get", "before");

    let mockReq = mockRequest({}, {"taskType": "testTask"}, {'from': "a@fb.com"}, {'query': "workerid=abcd&domain=DOM&timeout=10&count=5"});
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };

      transformer(mockIdentity("FACEBOOK", ["network-admin"], []), mockReq,
        null,
        callback);

    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/tasks/poll/batch/FACEBOOK___testTask?workerid=abcd&count=5&timeout=10&domain=FACEBOOK");
    });
  });

  test("GET task after", () => {
    let taskText = require('./tasks/polled_task.json');
    const taskJson = () => JSON.parse(JSON.stringify(taskText));
    let taskPrefixedText = require('./tasks/polled_task_prefixed.json');
    const taskPrefixedJson = () => JSON.parse(JSON.stringify(taskPrefixedText));

    const transformer = findTransformerFx(transformers, "/api/tasks/poll/:taskType", "get", "after");

    let exec = taskPrefixedJson();
    transformer(mockIdentity(), null, exec);

    expect(exec).toStrictEqual(taskJson());
  });

  test("GET tasks batch after", () => {
    let taskText = require('./tasks/polled_tasks.json');
    const taskJson = () => JSON.parse(JSON.stringify(taskText));
    let taskPrefixedText = require('./tasks/polled_tasks_prefixed.json');
    const taskPrefixedJson = () => JSON.parse(JSON.stringify(taskPrefixedText));

    const transformer = findTransformerFx(transformers, "/api/tasks/poll/batch/:taskType", "get", "after");

    let exec = taskPrefixedJson();
    transformer(mockIdentity(), null, exec);

    expect(exec).toStrictEqual(taskJson());
  });

  test("POST tasks result with dynamic_tasks", () => {
    const transformer = findTransformerFx(transformers, "/api/tasks", "post", "before");

    let workflowDefPrefixedText = require('./tasks/task_output_with_dynamictasks_prefixed.json');
    const workflowDefPrefixed = () => JSON.parse(JSON.stringify(workflowDefPrefixedText));
    let workflowDefText = require('./tasks/task_output_with_dynamictasks.json');
    const workflowDef = () => JSON.parse(JSON.stringify(workflowDefText));

    let mockReq = mockRequest(workflowDef(), {"taskType": "testTask"}, {'from': "a@fb.com"});
    return new Promise(resolve => {
      let callback = function (input) {
        streamToString(input.buffer).then((workflow) => resolve(workflow));
      };

      transformer(mockIdentity("FACEBOOK", ["network-admin"]), mockReq, null, callback);

    }).then((workflow) => {
      expect(JSON.parse(workflow)).toStrictEqual(workflowDefPrefixed());
    });
  });

  test("Response body size with UTF8", () => {
    let req = mockRequest({}, {}, {});
    let streamCopy = createProxyOptionsBuffer("ä UTF8 test", req);

    return new Promise(function (resolve, reject) {
      const Stream = require('stream')
      const writable = new Stream.Writable({objectMode: true})
      writable._write = (object, encoding, done) => {
        resolve(object)
      }
      streamCopy.pipe(writable)
    }).then(function (content) {
      expect(req.headers["content-length"]).toStrictEqual(12)
      expect(content).toStrictEqual("ä UTF8 test")
    })
  });
});
