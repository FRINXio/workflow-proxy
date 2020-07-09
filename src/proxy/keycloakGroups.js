// @flow

import kClient from "@fbc-hub/keycloak-client";

const RETRY_TIME = 5 * 1000; // 5 seconds

// repeatedly try to init the client
async function tryStart() {
  console.log(`Initializing keycloak at ${process.env.KEYCLOAK_HOST}`);
  kClient
    .init()
    .then(() => {
      console.log("Keycloak ready");
      // good
    })
    .catch((err) => {
      // important because when starting all the containers,
      // keycloak isn't immediately available
      console.log("Couldn't initilize keycloak client, trying again in 5 sec.");
      console.log(err);
      setTimeout(tryStart, RETRY_TIME);
    });
}

tryStart();

export async function groupsForUser(
  tenant: string,
  userEmail: string,
  role: string[],
  sessionId: ?string
): Promise<string[]> {
  const groups = await kClient.getGroupsForUser(userEmail, tenant);

  if (sessionId) {
    // TODO cache per session
    // TODO which cache to use ? there is some lru-cache in the packages folder
    // if (cache.get(sessionId)) {
    //   return cache.get(sessionId);
    // }
  }

  return groups.map((x) => x.name);
}

export async function rolesForUser(
  tenant: string,
  userEmail: string,
  sessionId: ?string
): Promise<string[]> {
  const roles = await kClient.getRolesForUser(userEmail, tenant);

  if (sessionId) {
    // TODO cache per session
  }

  return roles.map((x) => x.name);
}
