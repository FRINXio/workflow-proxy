import kClient from "@fbc-hub/keycloak-client";

const TENANT_POLL_INTERVAL = process.env.TENANT_POLL_INTERVAL ?? 15 * 1000; // 15 seconds
const RETRY_TIME = process.env.RETRY_TIME ?? 5 * 1000; // 5 seconds

const conf = {
  tenants: [],
};

async function pollKeycloak() {
  const cli = kClient.raw;
  const realms = await cli.realms.find();
  const tenants = [];
  for (const r of realms) {
    // skip the "master" realm
    if (r.realm === "master") continue;
    tenants.push(r.realm);
  }
  conf.tenants = tenants;
}

async function tryStart() {
  kClient
    .init()
    .then(() => {
      pollKeycloak();
      setInterval(pollKeycloak, TENANT_POLL_INTERVAL);
    })
    .catch((err) => {
      // important because when starting all the containers,
      // keycloak isn't immediately available
      console.log("Couldn't initilize keycloak client, trying again in a few seconds.", err);
      setTimeout(tryStart, RETRY_TIME);
    });
}
tryStart();

export function tenantRegistry() {
  return conf.tenants;
}
