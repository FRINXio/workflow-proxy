/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import request from 'request';

import type {FrontendResponse, ExpressRequest} from './types';

function makeOptions(
  method: string,
  url: string,
  parentRequest: ExpressRequest,
  body,
) {
  const options = {
    method,
    url,
    headers: {
      'x-tenant-id': parentRequest.headers['x-tenant-id'],
      'from': parentRequest.headers['from'],
      'x-auth-user-roles': parentRequest.headers['x-auth-user-roles'],
      'x-auth-user-groups': parentRequest.headers['x-auth-user-groups'],
      cookie: parentRequest.headers['cookie'],
      'Content-Type': 'application/json',
    },
    body: undefined,
    // setting `json: true` would help by automatically converting, but it adds
    // `Accept: application/json` header that triggers conductor's bug #376,
    // see https://github.com/Netflix/conductor/issues/376
  };
  // If body is empty object, convert it to null.
  // Otherwise the http library will send a request
  // with Content-Length: 2 :/
  let modifiedBody = null;
  if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    modifiedBody = JSON.stringify(body);
  }
  if (body != null) {
    options.body = modifiedBody;
  }
  return options;
}

function isSuccess(res) {
  return res.statusCode >= 200 && res.statusCode < 300;
}

function resolveSuccess(res, resolve) {
  const resCompatibileWithSuperagent = {
    text: res.body,
    statusCode: res.statusCode,
  };
  resolve(resCompatibileWithSuperagent);
}

function doHttpRequestWithOptions(options): Promise<FrontendResponse> {
  return new Promise<FrontendResponse>((resolve, reject) => {
    request(options, function(err, res) {
      if (res != null && isSuccess(res)) {
        resolveSuccess(res, resolve);
      } else if (res != null) {
        reject({message: 'Wrong status code', body: res.body, statusCode: res.statusCode});
      } else {
        reject(err);
      }
    });
  });
}

function doHttpRequest(
  method: string,
  url: string,
  parentRequest: ExpressRequest,
  body,
): Promise<FrontendResponse> {
  return doHttpRequestWithOptions(
    makeOptions(method, url, parentRequest, body),
  );
}

const HttpClient = {
  // TODO: refactor usage so that get method can be simplified
  get: <T>(path: string, parentRequest: ExpressRequest): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const options = makeOptions('GET', path, parentRequest);
      request(options, function(err, res) {
        if (res != null && isSuccess(res)) {
          try {
            // all GET methods should return json except when there is a failure
            resolve(JSON.parse(res.body));
          } catch (err) {
            console.warn(`Unexpected response body (invalid json): '${res.body}'`)
            reject({message: 'Unexpected response body (invalid json)', body: res.body, statusCode: res.statusCode});
          }
        } else if (res != null) {
          reject({message: 'Wrong status code', body: res.body, statusCode: res.statusCode});
        } else {
          reject(err);
        }
      });
    }),

  delete: <T>(
    path: string,
    data: T,
    parentRequest: ExpressRequest,
  ): Promise<FrontendResponse> => {
    return doHttpRequest('DELETE', path, parentRequest, data);
  },

  post: <T>(
    path: string,
    data: T,
    parentRequest: ExpressRequest,
  ): Promise<FrontendResponse> => {
    return doHttpRequest('POST', path, parentRequest, data);
  },

  put: <T>(
    path: string,
    data: T,
    parentRequest: ExpressRequest,
  ): Promise<FrontendResponse> => {
    return doHttpRequest('PUT', path, parentRequest, data);
  },
};

export default HttpClient;
