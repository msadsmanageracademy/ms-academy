// Contact fields an admin sees in participant lists (never passwords or tokens)
const CONTACT_PROJECTION = { first_name: 1, last_name: 1, email: 1 };

/**
 * Contact data of several users in one query, keyed by id (string).
 * Ids of deleted users are simply missing from the map.
 */
export async function findUserContacts(db, userIds) {
  if (userIds.length === 0) return new Map();
  const users = await db
    .collection("users")
    .find({ _id: { $in: userIds } }, { projection: CONTACT_PROJECTION })
    .toArray();
  return new Map(users.map((user) => [user._id.toString(), user]));
}
