/**
 * Read-only snapshot of everything the account-deletion sweep touches, for one user.
 *
 * Run it BEFORE deleting and again AFTER: every "erased" row must go to 0, every
 * "retained" row must keep its count, and no other account may change.
 *
 *   mongosh "mongodb://localhost/viva_mama" scripts/verify-account-deletion.js \
 *     --eval 'const USER_ID="6a27c5c9bf89eb76db14a1cb"'
 *
 * Deletes nothing. Only counts.
 */

/* global db, ObjectId, USER_ID, print */

const uid = ObjectId(USER_ID);
const sid = String(USER_ID);

// messages and conversations store userId as a STRING; every other collection uses an
// ObjectId. Mongoose casts on the way in so the service handles both, but a raw shell
// query has to match the stored type or it silently reports zero.
const ERASED_OBJECTID = [
    ["flow_instances", "userId"],
    ["consultations", "userId"],
    ["consultation_credits", "user_id"],
    ["usage_counters", "user_id"],
    ["subscriptions", "user_id"],
    ["mood_logs", "userId"],
    ["recommendation_histories", "userId"],
    ["supports", "userId"],
    ["analytics_events", "user_id"],
    ["ai_message_bookmarks", "userId"],
    ["viva_club_posts", "user"],
    ["viva_club_comments", "user"],
];
const ERASED_STRING = [
    ["messages", "userId"],
    ["conversations", "userId"],
];
const RETAINED = [
    ["payment_orders", "user_id"],
    ["bookconsultation_orders", "user_id"],
];
// Not swept by the service — legacy collections from an earlier model name. Listed so
// the snapshot makes the gap visible instead of hiding it.
const LEGACY_NOT_SWEPT = [
    ["vivaclubposts", "user"],
    ["vivaclubcomments", "user"],
];

let total = 0;

function section(title, spec, key) {
    print("");
    print(title);
    for (const [coll, field] of spec) {
        const n = db.getCollection(coll).countDocuments({ [field]: key });
        if (n) {
            total += n;
            print("  " + coll.padEnd(30) + n);
        }
    }
}

const user = db.users.findOne({ _id: uid });
print("=".repeat(70));
print("USER " + USER_ID);
if (!user) {
    print("  !! no users row — already deleted, or wrong id");
} else {
    print(
        "  phone=" + (user.mobile_number || "-") +
        "  email=" + (user.email || "-") +
        "  user_id=" + user.user_id,
    );
    print(
        "  children=" + (user.childs || []).length +
        "  consents=" + (user.consents || []).length +
        "  FCM=" + (user.FCM_token ? "set" : "none") +
        "  tier=" + ((user.subscription && user.subscription.tier) || "-"),
    );
    total += 1;
}

section("ERASED (must all reach 0):", ERASED_OBJECTID, uid);
section("", ERASED_STRING, sid);

// Indirect children — keyed on their parent, not on the user.
const flowIds = db.flow_instances.find({ userId: uid }, { _id: 1 }).toArray().map((d) => d._id);
const frCount = flowIds.length ? db.flow_responses.countDocuments({ flowInstanceId: { $in: flowIds } }) : 0;
if (frCount) { total += frCount; print("  flow_responses (via instance)".padEnd(32) + frCount); }

const consultIds = db.consultations.find({ userId: uid }, { _id: 1 }).toArray().map((d) => d._id);
const crCount = consultIds.length ? db.consultation_reviews.countDocuments({ consultationId: { $in: consultIds } }) : 0;
if (crCount) { total += crCount; print("  consultation_reviews (via consult)".padEnd(32) + crCount); }

print("");
print("  TOTAL ROWS THAT MUST DISAPPEAR: " + total);

section("RETAINED (counts must NOT change):", RETAINED, uid);
section("LEGACY, NOT SWEPT (known gap):", LEGACY_NOT_SWEPT, uid);

print("");
print("CROSS-ACCOUNT EFFECTS (must reach 0):");
print("  likes left on other people's posts   " +
    (db.viva_club_posts.countDocuments({ likes: uid, user: { $ne: uid } }) +
     db.vivaclubposts.countDocuments({ likes: uid, user: { $ne: uid } })));
print("  accounts referring this user         " +
    db.users.countDocuments({ referred_user_object_id: uid }));
const ownPosts = db.viva_club_posts.find({ user: uid }, { _id: 1 }).toArray().map((d) => d._id);
print("  others' comments on this user's posts " +
    (ownPosts.length ? db.viva_club_comments.countDocuments({ post: { $in: ownPosts }, user: { $ne: uid } }) : 0));

print("");
print("WHOLE-DB TOTALS (only this user's rows should move):");
for (const c of ["users", "messages", "conversations", "flow_responses", "analytics_events"]) {
    print("  " + c.padEnd(24) + db.getCollection(c).countDocuments());
}
