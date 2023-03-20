/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import HttpClient from './http-server-side';
import Router from 'express';
import bodyParser from 'body-parser';
import filter from 'lodash/fp/filter';
import forEach from 'lodash/fp/forEach';
import identity from 'lodash/fp/identity';

import map from 'lodash/fp/map';
import moment from 'moment';
import transform from 'lodash/fp/transform';

import type { $Application, ExpressRequest, ExpressResponse } from 'express';
import type { TaskType } from './types';

const uuid_regex =
  /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
const WORKFLOW_SORT_TYPES: Array<string> = [
  'workflowId',
  'workflowType',
  'startTime',
  'endTime',
  'status',
  'workflowId:ASC',
  'workflowId:DESC',
  'workflowType:ASC',
  'workflowType:DESC',
  'startTime:ASC',
  'startTime:DESC',
  'endTime:ASC',
  'endTime:DESC',
  'status:ASC',
  'status:DESC',
];

const WORKFLOW_STATUS_TYPES: Array<string> = [
  'FAILED',
  'COMPLETED',
  'TERMINATED',
  'RUNNING',
  'PAUSED',
  'TIMED_OUT',
];

const http = HttpClient;

const findSchedule = (schedules, name) => {
  for (const schedule of schedules) {
    if (schedule.name === name) {
      return schedule;
    }
  }
  return null;
};

/* This function validate query parameters (workflowId, workflowType, order, status) used for
searching executed workflows by freeText search query.
If input parameters are not valid, function return exception with an array object with status and error message. */
export function format_query(req) {
  const UNDEFINED = 'undefined';
  const query = [];

  console.log(req.query);

  if (
    typeof req.query.workflowId !== UNDEFINED &&
    req.query.workflowId !== ''
  ) {
    if (req.query.workflowId.match(uuid_regex) !== null) {
      query.push(`workflowId='${req.query.workflowId}'`);
    } else if (
      typeof req.query.workflowId !== UNDEFINED &&
      req.query.workflowId.match(uuid_regex) === null
    ) {
      query.push(`workflowType='${req.query.workflowId}'`);
    }
  }

  if (typeof req.query.status !== UNDEFINED && req.query.status !== '') {
    if (WORKFLOW_STATUS_TYPES.includes(req.query.status)) {
      query.push("status='" + req.query.status + "'");
    } else {
      throw [
        false,
        'Query input ' +
          req.query.status +
          ' for filtering by status is not valid',
      ];
    }
  }

  // TODO fix sort in conductor archive
  // const orderQuery = [];

  // if (typeof req.query.order !== 'undefined' && req.query.order !== '') {
  //   req.query.order.split(',').forEach((element) => {
  //     if (WORKFLOW_SORT_TYPES.includes(element)) {
  //       orderQuery.push('sort=' + element);
  //     } else {
  //       throw [
  //         false,
  //         'Query input order=' + element + ' for sorting is not valid',
  //       ];
  //     }
  //   });
  // } else {
  //   orderQuery.push('sort=startTime:DESC');
  // }

  var ret_query = query.join(' AND ');

  return ret_query;
}

//TODO merge with proxy
export default async function (
  baseURL: string,
): Promise<$Application<ExpressRequest, ExpressResponse>> {
  const router = Router();
  const baseApiURL = baseURL + 'api/';
  const baseURLWorkflow = baseApiURL + 'workflow/';
  const baseURLMeta = baseApiURL + 'metadata/';
  const baseURLTask = baseApiURL + 'tasks/';
  const eventURL = baseApiURL + 'event';
  const baseURLSchedule = baseURL + 'schedule/';

  router.use(bodyParser.urlencoded({ extended: false }));
  router.use('/', bodyParser.json());

  router.get('/metadata/taskdefs', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.get(baseURLMeta + 'taskdefs', req);
      res.status(200).send({ result });
    } catch (err) {
      if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.post('/metadata/taskdefs', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.post(baseURLMeta + 'taskdefs', req.body, req);
      res.status(200).send(result);
    } catch (err) {
      if (err.body) {
        res.status(500).send(err.body);
      } else {
        res.status(400).send(err.response.body);
      }
      next(err);
    }
  });

  router.get(
    '/metadata/taskdefs/:name',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.get(
          baseURLMeta + 'taskdefs/' + req.params.name,
          req,
        );
        res.status(200).send({ result });
      } catch (err) {
        if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.delete(
    '/metadata/taskdefs/:name',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.delete(
          baseURLMeta + 'taskdefs/' + req.params.name,
          null,
          req,
        );
        res.status(200).send({ result });
      } catch (err) {
        if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.get('/metadata/workflow', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.get(baseURLMeta + 'workflow', req);
      let schedules = [];

      // combine with schedules
      try {
        schedules = await http.get(baseURLSchedule, req);
      } catch (err) {
        // continue if Schellar is not reachable
        console.log(err);
      }

      for (const workflowDef of result) {
        const expectedScheduleName =
          workflowDef.name + ':' + workflowDef.version;
        const found = findSchedule(schedules, expectedScheduleName);
        workflowDef.hasSchedule = found != null;
        workflowDef.expectedScheduleName = expectedScheduleName;
      }

      res.status(200).send({ result });
    } catch (err) {
      if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.delete(
    '/metadata/workflow/:name/:version',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.delete(
          baseURLMeta +
            'workflow/' +
            req.params.name +
            '/' +
            req.params.version,
          null,
          req,
        );
        res.status(200).send({ result });
      } catch (err) {
        if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.get(
    '/metadata/workflow/:name',
    async (req: ExpressRequest, res, next) => {
      try {
        let version;
        if (
          typeof req.query.version !== 'undefined' &&
          !isNaN(req.query.version)
        ) {
          version = req.query.version;
        }

        const result = await http.get(
          baseURLMeta + 'workflow/' + req.params.name + '?version=' + version,
          req,
        );
        res.status(200).send({ result });
      } catch (err) {
        if (err.body) {
          res.status(err.statusCode).send(err.body);
        }
        next(err);
      }
    },
  );

  router.put('/metadata/workflow', async (req: ExpressRequest, res, next) => {
    try {
      req.body.forEach(function (body) {
        if (body.name === undefined || body.name.length === 0) {
          throw 'Empty or undefined workflow name in workflow definiton';
        }
      });

      const result = await http.put(baseURLMeta + 'workflow/', req.body, req);
      res.status(200).send(result);
    } catch (err) {
      if (err.body) {
        res.status(500).send(err.body);
      } else if (err) {
        res.status(500).send(err);
      } else {
        res.status(400).send(err?.response?.body);
      }
      next(err);
    }
  });

  // Conductor only allows POST for event handler creation
  // and PUT for updating. This code works around the issue by
  // trying PUT if POST fails.
  router.post('/event', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.post(eventURL, req.body, req);
      res.status(200).send(result);
    } catch (err) {
      console.info(`Got exception ${JSON.stringify(err)} while POSTing event`);
      try {
        const result = await http.put(eventURL, req.body, req);
        res.status(200).send(result);
      } catch (e) {
        console.info(`Got exception ${JSON.stringify(e)} while PUTting event`);
        if (e.body) {
          res.status(500).send(e.body);
        } else {
          res.status(400).send('Post and Put failed');
        }
        next(e);
      }
    }
  });

  router.post('/workflow', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.post(baseURLWorkflow, req.body, req);

      res.status(200).send(result);
    } catch (err) {
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.get('/executions', async (req: ExpressRequest, res, next) => {
    try {
      const freeText_search = '*';

      const query = format_query(req);

      let start: number = 0;
      if (typeof req.query.start !== 'undefined' && !isNaN(req.query.start)) {
        start = req.query.start;
      }

      let size: number = 5000;
      if (typeof req.query.size !== 'undefined' && !isNaN(req.query.size)) {
        size = req.query.size;
      }

      const url =
        baseURLWorkflow +
        'search?size=' +
        size +
        '&freeText=' +
        freeText_search +
        '&start=' +
        start +
        '&query=' +
        query;

      const result = await http.get(url, req);
      const hits = result.results;
      res.status(200).send({
        result: {
          hits: hits,
          totalHits: Number(start) + Number(hits.length) + 1,
        },
      });
    } catch (err) {
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      } else if (!err[0]) {
        /* Handling exception from freeText_query method.
           This method return array with status (err[0]) and
           error message (err[1]) */
        res.status(500).send(JSON.stringify(err[1]));
      }
      next(err);
    }
  });

  router.post(
    '/workflow/bulk/terminate',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.post(
          baseURLWorkflow + 'bulk/terminate',
          req.body,
          req,
        );
        res.status(200).send(result);
      } catch (err) {
        if (err.body && err.statusCode) {
          res.status(err.statusCode).send(err.body);
        } else if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.put('/workflow/bulk/pause', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.put(
        baseURLWorkflow + 'bulk/pause',
        req.body,
        req,
      );
      res.status(200).send(result);
    } catch (err) {
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.put(
    '/workflow/bulk/resume',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.put(
          baseURLWorkflow + 'bulk/resume',
          req.body,
          req,
        );
        res.status(200).send(result);
      } catch (err) {
        if (err.body && err.statusCode) {
          res.status(err.statusCode).send(err.body);
        } else if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.post(
    '/workflow/bulk/retry',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.post(
          baseURLWorkflow + 'bulk/retry',
          req.body,
          req,
        );
        res.status(200).send(result);
      } catch (err) {
        if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.post(
    '/workflow/bulk/restart',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.post(
          baseURLWorkflow + 'bulk/restart',
          req.body,
          req,
        );
        res.status(200).send(result);
      } catch (err) {
        if (err.body && err.statusCode) {
          res.status(err.statusCode).send(err.body);
        } else if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.delete(
    '/workflow/:workflowId',
    async (req: ExpressRequest, res, next) => {
      const archiveWorkflow = req.query.archiveWorkflow === 'true';
      try {
        const result = await http.delete(
          baseURLWorkflow +
            req.params.workflowId +
            '/remove?archiveWorkflow=' +
            archiveWorkflow.toString(),
          req.body,
          req,
        );
        res.status(200).send(result);
      } catch (err) {
        if (err.body && err.statusCode) {
          res.status(err.statusCode).send(err.body);
        } else if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.get('/id/:workflowId', async (req: ExpressRequest, res, next) => {
    try {
      let include_task = 'includeTasks=true';

      if (req.query.includeTasks === 'false') {
        include_task = 'includeTasks=false';
      }

      const result = await http.get(
        baseURLWorkflow + req.params.workflowId + '?' + include_task,
        req,
      );

      let meta = result.workflowDefinition;
      if (!meta) {
        meta = await http.get(
          baseURLMeta +
            'workflow/' +
            result.workflowType +
            '?version=' +
            result.version,
          req,
        );
      }

      const subs = filter(identity)(
        map((task: TaskType): ?TaskType => {
          if (task.taskType === 'SUB_WORKFLOW' && task.inputData) {
            const subWorkflowId = task.inputData.subWorkflowId;

            if (subWorkflowId != null) {
              return {
                name: task.inputData?.subWorkflowName,
                version: task.inputData?.subWorkflowVersion,
                referenceTaskName: task.referenceTaskName,
                subWorkflowId: subWorkflowId,
              };
            }
          }
        })(result.tasks || []),
      );

      const logs = map((task) =>
        Promise.all([task, http.get(baseURLTask + task.taskId + '/log', req)]),
      )(result.tasks);
      const LOG_DATE_FORMAT = 'MM/DD/YY, HH:mm:ss:SSS';

      await Promise.all(logs).then((result) => {
        forEach(([task, logs]) => {
          if (logs) {
            task.logs = map(
              ({ createdTime, log }) =>
                `${moment(createdTime).format(LOG_DATE_FORMAT)} : ${log}`,
            )(logs);
          }
        })(result);
      });

      const fun: (Array<TaskType>) => Array<Promise<mixed>> = map(
        ({ name, version, subWorkflowId, referenceTaskName }) =>
          Promise.all([
            referenceTaskName,
            http.get(
              baseURLMeta + 'workflow/' + name + '?version=' + version,
              req,
            ),
            http.get(
              baseURLWorkflow + subWorkflowId + '?includeTasks=true',
              req,
            ),
          ]),
      );
      const promises = fun(subs);

      const subworkflows = await Promise.all(promises).then((result) => {
        return transform(
          result,
          (result, [key, meta, wfe]) => {
            result[key] = { meta, wfe };
          },
          {},
        );
      });

      res.status(200).send({ result, meta, subworkflows: subworkflows });
    } catch (err) {
      console.log(err);
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.get('/hierarchical', async (req: ExpressRequest, res, next) => {
    try {
      const freeText_search = 'root_wf';
      const query = format_query(req);

      let size: number = 5000;
      if (typeof req.query.size !== 'undefined' && !isNaN(req.query.size)) {
        size = req.query.size;
      }

      let start: number = 0;
      if (typeof req.query.start !== 'undefined' && !isNaN(req.query.start)) {
        start = req.query.start;
      }

      const url =
        baseURLWorkflow +
        'search?size=' +
        size +
        '&freeText=' +
        freeText_search +
        '&start=' +
        start +
        '&query=' +
        query;

      const result = await http.get(url, req);
      const hits = result.results;
      res.status(200).send({
        result: {
          hits: hits,
          totalHits: Number(start) + Number(hits.length) + 1,
        },
      });
    } catch (err) {
      console.warn('Unable to construct hierarchical view', { error: err });
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      } else if (!err[0]) {
        /* Handling exception from freeText_query method.
           This method return array with status (err[0]) and
           error message (err[1]) */
        res.status(500).send(JSON.stringify(err[1]));
      }
      next(err);
    }
  });

  router.get('/schedule', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.get(baseURLSchedule, req);
      res.status(200).send(result);
    } catch (err) {
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.get('/schedule/:name', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.get(baseURLSchedule + req.params.name, req);
      res.status(200).send(result);
    } catch (err) {
      console.warn('Failed to GET', { error: err });
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.put('/schedule/:name', async (req: ExpressRequest, res, next) => {
    const urlWithName = baseURLSchedule + req.params.name;
    try {
      // create using POST
      const result = await http.post(baseURLSchedule, req.body, req);
      res.status(result.statusCode).send(result.text);
    } catch (postError) {
      try {
        // update using PUT
        const result = await http.put(urlWithName, req.body, req);
        res.status(result.statusCode).send(result.text);
      } catch (putError) {
        console.warn('Failed to POST,PUT', { postError, putError });
        next(putError);
      }
    }
  });

  router.delete('/schedule/:name', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.delete(
        baseURLSchedule + req.params.name,
        null,
        req,
      );
      res.status(result.statusCode).send(result.text);
    } catch (err) {
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.get(
    '/workflow/running/:name',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.get(
          baseURLWorkflow + 'running/' + req.params.name,
          req,
        );
        res.status(200).send(result);
      } catch (err) {
        if (err.body && err.statusCode) {
          res.status(err.statusCode).send(err.body);
        } else if (err.body) {
          res.status(500).send(err.body);
        }
        next(err);
      }
    },
  );

  router.get('/event', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.get(baseApiURL + 'event/', req);
      res.status(200).send(result);
    } catch (err) {
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.delete('/event/:name', async (req: ExpressRequest, res, next) => {
    try {
      const result = await http.delete(
        baseApiURL + 'event/' + req.params.name,
        req,
      );
      res.status(200).send(result);
    } catch (err) {
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.get('/queue/data', async (req, res, next) => {
    try {
      const queueNamesToSizes = await http.get(baseURLTask + 'queue/all', req);
      const polldata = [];
      for (const name in queueNamesToSizes) {
        polldata.push({
          queueName: name,
          qsize: queueNamesToSizes[name],
          lastPollTime: null,
        });
      }
      res.status(200).send({ polldata });
    } catch (err) {
      if (err.body && err.statusCode) {
        res.status(err.statusCode).send(err.body);
      } else if (err.body) {
        res.status(500).send(err.body);
      }
      next(err);
    }
  });

  router.get(
    '/external/postgres/:dataId',
    async (req: ExpressRequest, res, next) => {
      try {
        const result = await http.get(baseURL + 'api' + req.originalUrl, req);
        res.status(200).send(result);
      } catch (err) {
        if (err.body && err.statusCode) {
          res.status(err.statusCode).send(err.body);
        } else if (err.body) {
          res.status(500).send(err.body);
          console.log(err);
        }
        next(err);
      }
    },
  );

  return router;
}
