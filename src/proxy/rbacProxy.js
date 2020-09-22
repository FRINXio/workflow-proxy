/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */
import Router from 'express';
import {getUserGroups, getUserRoles} from './utils.js';
import type {
  AuthorizationCheck,
  ProxyRequest,
  ProxyResponse,
} from '../types';

const rbacRouter = Router<ProxyRequest, ProxyResponse>();

export default async function(
  authorizationCheck: AuthorizationCheck,
) {
  rbacRouter.get('/editableworkflows', async (req: ProxyRequest, res) => {
    const role = getUserRoles(req);
    const groups = getUserGroups(req);

    if (authorizationCheck(role, groups)) {
      res.status(200).send(true);
    } else {
      res.status(200).send(false);
    }
  });

  return rbacRouter;
}
