import test from "node:test";
import assert from "node:assert/strict";
import worker, { validateHeartbeat } from "../src/index.mjs";

const valid = {
  installationId: "9f1e9dc1-bca5-44c2-b3a5-1c8b74b36db4",
  appVersion: "0.9.0-rc.11",
  platform: "windows",
  architecture: "x86_64",
};

test("accepts only the four anonymous release dimensions", () => {
  assert.deepEqual(validateHeartbeat(valid), valid);
});

test("rejects identifiers and dimensions outside the protocol", () => {
  assert.equal(validateHeartbeat({ ...valid, installationId: "Sabin" }), null);
  assert.equal(validateHeartbeat({ ...valid, platform: "browser" }), null);
  assert.equal(validateHeartbeat({ ...valid, appVersion: "<script>" }), null);
  assert.equal(validateHeartbeat({ ...valid, architecture: "x86 64" }), null);
});

test("drops additional personal fields before persistence", () => {
  assert.deepEqual(validateHeartbeat({
    ...valid,
    ownerName: "Sabin",
    petName: "Nova",
    activity: { keys: 20 },
  }), valid);
});

function recordingDatabase() {
  const runs = [];
  return {
    runs,
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async run() {
          runs.push({ sql: this.sql, values: this.values });
          return { success: true };
        },
      };
    },
  };
}

test("stores a keyed hash instead of the raw installation id", async () => {
  const database = recordingDatabase();
  const response = await worker.fetch(new Request("https://counter.test/v1/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...valid, ownerName: "must be discarded" }),
  }), {
    USAGE_DB: database,
    INSTALLATION_HASH_SECRET: "a-test-secret-that-is-longer-than-32-characters",
  });

  assert.equal(response.status, 204);
  assert.equal(database.runs.length, 1);
  const values = database.runs[0].values;
  assert.equal(values[0].length, 64);
  assert.notEqual(values[0], valid.installationId);
  assert.deepEqual(values.slice(1, 4), [valid.platform, valid.architecture, valid.appVersion]);
  assert.equal(database.runs[0].sql.includes("owner"), false);
});

test("deletes the keyed server record on opt-out", async () => {
  const database = recordingDatabase();
  const response = await worker.fetch(new Request("https://counter.test/v1/heartbeat", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ installationId: valid.installationId }),
  }), {
    USAGE_DB: database,
    INSTALLATION_HASH_SECRET: "a-test-secret-that-is-longer-than-32-characters",
  });

  assert.equal(response.status, 204);
  assert.equal(database.runs.length, 1);
  assert.match(database.runs[0].sql, /DELETE FROM installations/);
  assert.equal(database.runs[0].values[0].length, 64);
});

test("protects aggregate statistics with the private token", async () => {
  const env = { STATS_TOKEN: "private-statistics-token" };
  const response = await worker.fetch(new Request("https://counter.test/v1/stats"), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects oversized request bodies before parsing", async () => {
  const response = await worker.fetch(new Request("https://counter.test/v1/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "4096" },
    body: JSON.stringify(valid),
  }), { INSTALLATION_HASH_SECRET: "a-test-secret-that-is-longer-than-32-characters" });
  assert.equal(response.status, 400);
});
