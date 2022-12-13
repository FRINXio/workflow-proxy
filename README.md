# Workflow Proxy

Workflow proxy is an API proxy component for [conductor workflow engine](https://github.com/Netflix/conductor) that adds following features:
* Multitenancy - has been removed !
* RBAC support
* Workflow scheduling
* Additional features required by [frinx-workflow-ui](https://github.com/FRINXio/frinx-workflow-ui)

## Workflow proxy architecture

```
+--------------------------------------------------------------------------------------------+
|                                                                                            |
|   Workflow proxy                                                                           |
|                                                                                            |
|                /                                                                           |
|                 +----------------------+                                                   |
|                 | Conductor proxy      |                                                   |
|                 |  routes.js           |                                                   |
|                 |                      |                                                   |
|                 +----------+-----------+                                                   |
|                            | HTTP                                                          |
|                /proxy      |                                  /                            |
|                 +----------v-----------+                       +----------------------+    |
|                 | RBAC proxy           |                       | Task proxy           |    |
|                 |  proxy.js            <                       |  task+proxy.js       |    |
|                 |  transformers/*.js   |                       |                      |    |
|                 +----+------+----------+                       +-----------+----------+    |
|                      |      |                                              |               |
|                      |      |                                              |               |
+--------------------------------------------------------------------------------------------+
                       |      |                                              |
          +------------+      | HTTP                                         |
          |                   |                                              |
          |                   |             /api                             |
+---------v--------+      +---v---------------------------------+            |
| Schellar         |      | Conductor built in REST API         |            |
|                  |      |                                     <------------+
|                  |      |                                     |
+------------------+      +-------------------------------------+

```

The main components are:
* Conductor proxy
  * Additional features (REST api endpoints) required by [frinx-workflow-ui](https://github.com/FRINXio/frinx-workflow-ui)
* RBAC proxy
  * RBAC support

## User facing proxy

The RBAC proxy + conductor proxy form a single logical component: **User facing proxy** and are proxying following conductor REST endpoints:
* Workflow metadata (workflow definitions)
* Task metadata (task definitions)
* Task execution (polling / ACK / updates)
* Workflow executions
* Bulk operations for workflow executions
* Workflow schedules 
* Events

This is the main proxy that is used whenever the user's browser interacts with
Conductor APIs. It expects following authentication headers:
* from
* x-auth-user-roles
* x-auth-user-groups

The execution path from when a request hits User facing proxy is as follows:
1. Conductor proxy
2. RBAC proxy
3. Conductor

### Conductor proxy

Conductor proxy just adds a couple small features not present in conductor's API.
One example is hierarchical workflow execution lookup that allows a user to retrieve a workflow execution including all of its subworkflows.
For all the other endpoints, it is just a pass through.

Features implemented by this component are required by the workflow-ui.

### Tenant proxy

Tenant proxy has been removed and only following functionality has been left:

List of transformations performed in tenant proxy per endpoint:
* Workflow metadata (workflow definitions)
  * Add user id into workflow's `ownerEmail` field
* Workflow executions
  * Add user id into `correlationId` field of workflow execution
    * To preserve the information about workflow executor

#### Scheduling

Workflow scheduling is handled by an external component [schellar](https://github.com/FRINXio/schellar).

#### RBAC

RBAC proxy adds 2 features on top of residual tenant proxy:
* Ensures user authorization to access certain endpoints
* Filters workflow definitions and workflow executions based on user's roles, groups and userID

RBAC support simply distinguishes 2 user types: an admin and everyone else.
An admin has full access to workflow API while ordinary user can only:
* Read workflow definitions
  * Ordinary user can only view workflow definitions belonging to the same groups
  * A workflow definition (created by an admin) can have multiple labels assigned
  * A user can belong into multiple groups 
    * User groups are identified in HTTP request's header field `x-auth-user-roles`
  * If an ordinary user's group matches one of workflow labels, the workflow becomes visible to the user
* Execute visible workflow definitions 
* Monitor running executions
  * Only those executed by the user currently logged in

Admin user is identified by having the role `OWNER` or belonging to group `netowork-admin`.
These are sent to the proxy via HTTP header entries.
These are configurable.

## User guide

Workflow proxy is a standalone component that needs to be deployed in a way to access:
* Conductor server REST API
* Schellar REST API
* Keycloak REST API

and provides a unified REST API over all of these components.

There is no schema such as OpenAPI to describe workflow proxy. But since it copies underlying APIs, the documentation for them should be found here:
* https://github.com/FRINXio/schellar
* https://netflix.github.io/conductor/apispec/

> Example queries for the proxy can be found in [test-queries.rest](./test-queries.rest)

To start workflow proxy consult the scripts in `package.json`.

### Configuration

Default port for user facing proxy: **8088**, Env: `USER_FACING_PORT`

Default port for task proxy: **8089**, Env: `TASK_PROXY_PORT`

Default limit for task proxy: **'50mb'**, Env: `TASK_PROXY_LIMIT`

Default conductor URL to proxy: **http://conductor-server:8080**, Env: `PROXY_TARGET`

Default schellar URL to proxy: **http://schellar:3000**, Env: `SCHELLAR_TARGET`

Default url for querying keycloak in task proxy: **keycloak:8080**, Env: `KEYCLOAK_HOST`

Default client ID for querying keycloak in task proxy: **admin-cli**, Env: `KEYCLOAK_ADMIN_CLIENT_ID`

Default username for querying keycloak in task proxy: **admin**, Env: `KEYCLOAK_ADMIN_CLIENT_USERNAME`

Default password for querying keycloak in task proxy: **admin**, Env: `KEYCLOAK_ADMIN_CLIENT_PASSWORD`

Default user role to allow admin access in RBAC proxy: **OWNER**, Env: `ADMIN_ACCESS_ROLE`

Default user group to allow admin access in RBAC proxy: **NETWORK-ADMIN**, Env: `ADMIN_ACCESS_GROUP`

## Swagger UI 

OpenAPI documentation for workflow-proxy is accessible on route `/docs`.  <br>
Workflow-proxy support OAuth 2.0 Authorization with `authorizationCode flow`!

Read more about configuration on [Swagger Docs](https://swagger.io/docs/specification/authentication/oauth2/).

### Configuration

Enable/Disable oAuth2 authorization: Env: `OAUTH2`, default false

Identity platform authorize URL: **authorizationUrl**, Env: `OAUTH2_AUTH_URL`

Identity platform token URL: **tokenUrl**, Env: `OAUTH2_TOKEN_URL`

Define uniconfig swagger servers: Env: `UNICONFIG_ZONES_LIST`, default uniconfig
  - example: UNICONFIG_ZONES_LIST=uniconfig1,uniconfig2

## Developer guide

Workflow proxy is one big http proxy component, relying mostly on `http-proxy` and `express` libraries.

Some useful pointers for developers:
* src/proxy/transformers/* - transformer functions that filter and modify requests/data to actually implement multitenancy, RBAC etc.
* src/proxy/transformers/```__tests__``` - unit tests for transformer functions
* src/proxy/transformer-registry - transformer function collector
* src/proxy/proxy - user facing proxy router
* src/task-proxy - task proxy router
* src/routes.js - conductor proxy

There is a Dockerfile to build a container image.

Workflow proxy can be run with nodemon for development purposes.
