// @flow

export async function groupsForUser(
  tenant: string,
  userEmail: string,
  role: string,
  sessionId: ?string,
): Promise<string[]> {
  // Sample output
  // {
  //   "data": {
  //     "user": {
  //       "groups": [
  //         {
  //           "id": "171798691840",
  //           "name": "group4",
  //           "members": [
  //             {
  //               "groups": [
  //                 {
  //                   "name": "group4"
  //                 }
  //               ]
  //             }
  //           ]
  //         }
  //       ]
  //     }
  //   }
  // }

  // Add group
  // mutation addUserGroup {
  //   addUsersGroup(input: {name:"group4"}) {
  //     id
  //     name
  //     status
  //     members {
  //       authID
  //     }
  //   }
  // }

  // Add user to group
  // mutation editUsersGroup{
  //   editUsersGroup(input: {
  //     id: 171798691840,
  //     description: "test",
  //     members: [167503724544],
  //   }) {
  //     id
  //     members {
  //       id
  //       email
  //     }
  //   }
  // }

  // Query groups
  // query allGroups {
  //   usersGroups {
  //     edges {
  //       node {
  //         name
  //         id
  //       }
  //     }
  //   }
  // }

  if (sessionId) {
    // TODO cache per session
    // TODO which cache to use ? there is some lru-cache in the packages folder
    // if (cache.get(sessionId)) {
    //   return cache.get(sessionId);
    // }
  }

  return [];
}
