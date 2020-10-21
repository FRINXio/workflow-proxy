/*
Proxy around conductor that adds fairness - prevents one tenant from exhausting the worker.
For each batch poll, every tenant's task queue is queried. All results are then combined.
Workers send 'count' query parameter to limit number of results. However, they can receive
up to (tenants.length * count) results.
*/
import request from 'request-promise-native';
import ExpressApplication from 'express';
import {tenantRegistry} from './tenant-registry';
import genericProxy from './generic-proxy';
import qs from 'querystring';

const app = ExpressApplication();

const taskProxy = {
  init: function (conductorProxyTarget, port) {
    const transformers = [
      {
        url: '/api/tasks/poll/batch/:taskType',
        method: 'get',
        instead: async function (req, res) {
          const taskType = req.params.taskType;
          const workerid = req.query.workerid;
          const count = req.query.count;
          const timeout = req.query.timeout;
          const tenants = tenantRegistry();
          const promises = [];
          for (const domain of tenants) {
            const queryUrl = conductorProxyTarget + '/api/tasks/poll/batch/' + taskType + '?' +
              qs.stringify({workerid, count, timeout, domain});
            const requestOptions = {
              url: queryUrl,
              method: 'GET',
            };
            const responsePromise = request(requestOptions);
            promises.push(responsePromise);
          }
          const responses = await Promise.all(promises);
          const result = responses.map((x) => JSON.parse(x)).flat();
          if (result.length > 0) {
            console.debug('merged tasks', JSON.stringify(result));
          }
          res.send(result);
        },
      },
      {
        url: '/api/tasks/poll/*',
        method: 'get',
        instead: async function (req, res, proxyCallback) {
          console.warn('Warning: Using polling API that does not support fair task distribution');
          proxyCallback();
        },
      },
      {
        url: '*',
        method: 'all',
      },
    ];
    const proxyRouter = genericProxy('tp', conductorProxyTarget, transformers);
    app.use('/', proxyRouter);
    app.listen(port);
  },

  live: function () {
    return true;
  },

  ready: function() {
    try {
      tenantRegistry();
    } catch (e) {
      console.warn("Keycloak client not ready yet");
      return false;
    }
    return true;
  },

};

export default taskProxy;
