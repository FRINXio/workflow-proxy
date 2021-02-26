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
import {findTransformerFx, mockRequest, mockResponse} from './metadata-workflowdef-test';
import {mockIdentity} from "./metadata-workflowdef-rbac-test";

describe('Task transformers', () => {

  const transformers = tasks({"proxyTarget": "PROXY_TARGET"});

  test("GET task before", () => {
    const transformer = findTransformerFx(transformers, "/api/tasks/poll/:taskType", "get", "before");

    let mockReq = mockRequest({},{"taskType": "testTask"},{'from': "a@fb.com"}, );
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };

      transformer(mockIdentity("FACEBOOK", ["network-admin"], []), mockReq,
      null,
      callback);

    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/tasks/poll/FACEBOOK___testTask");
    });
  });

  test("GET task before with additional params", () => {
    const transformer = findTransformerFx(transformers, "/api/tasks/poll/:taskType", "get", "before");

    let mockReq = mockRequest({},{"taskType": "testTask"},{'from': "a@fb.com"}, {'query': "workerid=abcd&domain=DOM"});
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };

      transformer(mockIdentity("FACEBOOK", ["network-admin"], []), mockReq,
      null,
      callback);

    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/tasks/poll/FACEBOOK___testTask?workerid=abcd&domain=DOM");
    });
  });

  test("GET tasks batch before with additional params", () => {
    const transformer = findTransformerFx(transformers, "/api/tasks/poll/batch/:taskType", "get", "before");

    let mockReq = mockRequest({},{"taskType": "testTask"},{'from': "a@fb.com"}, {'query': "workerid=abcd&domain=DOM&timeout=10"});
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };

      transformer(mockIdentity("FACEBOOK", ["network-admin"], []), mockReq,
      null,
      callback);

    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/tasks/poll/batch/FACEBOOK___testTask?workerid=abcd&domain=DOM&timeout=10");
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
});
