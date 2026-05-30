import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  getCurrentVersion,
  getPackageName,
  readPackageMetadata,
} from "../src/core/version.js";

/**
 * package.json 읽기 mock 함수를 만듭니다.
 *
 * @param {string} content readFileSync가 반환할 JSON 문자열입니다.
 * @returns {(path: string, encoding: BufferEncoding) => string} version 모듈에 주입할 readFileSync 대체 함수입니다.
 */
function createReadFileMock(content) {
  return (filePath, encoding) => {
    // version 모듈이 UTF-8로 package.json을 읽는지 검증하기 위해 encoding도 함께 확인합니다.
    assert.equal(typeof filePath, "string");
    assert.equal(encoding, "utf8");
    return content;
  };
}

test("AJ readPackageMetadata reads package metadata without using cwd", () => {
  const metadata = readPackageMetadata({
    packageJsonPath: "package.json",
    readFileSync: createReadFileMock(
      JSON.stringify({
        name: "convention-cli",
        version: "1.2.3",
      }),
    ),
  });

  assert.deepEqual(metadata, {
    name: "convention-cli",
    version: "1.2.3",
  });
});

test("AJ getCurrentVersion returns normal and prerelease versions", () => {
  assert.equal(
    getCurrentVersion({
      readFileSync: createReadFileMock('{"version":"1.2.3"}'),
    }),
    "1.2.3",
  );
  assert.equal(
    getCurrentVersion({
      readFileSync: createReadFileMock('{"version":"1.2.3-beta.1"}'),
    }),
    "1.2.3-beta.1",
  );
});

test("AJ getPackageName returns a valid package name", () => {
  assert.equal(
    getPackageName({
      readFileSync: createReadFileMock('{"name":"convention-cli"}'),
    }),
    "convention-cli",
  );
});

test("AJ version helpers reject missing, empty, and malformed package metadata safely", () => {
  assert.throws(
    () =>
      getCurrentVersion({
        readFileSync: createReadFileMock('{"name":"convention-cli"}'),
      }),
    /package version/,
  );
  assert.throws(
    () =>
      getCurrentVersion({
        readFileSync: createReadFileMock('{"version":""}'),
      }),
    /package version/,
  );
  assert.throws(
    () =>
      getPackageName({
        readFileSync: createReadFileMock('{"name":""}'),
      }),
    /package name/,
  );
  assert.throws(
    () =>
      readPackageMetadata({
        readFileSync: createReadFileMock('{"version":'),
      }),
    /package\.json 정보를 읽을 수 없습니다/,
  );
});

test("AJ CLI --version prints package version and does not print help", () => {
  const output = execFileSync(process.execPath, ["bin/convention.js", "--version"], {
    encoding: "utf8",
  });

  assert.equal(output.trim(), getCurrentVersion());
  assert.doesNotMatch(output, /Usage|Options|--batch|--step/);
});

test("AJ CLI -V prints the same package version", () => {
  const output = execFileSync(process.execPath, ["bin/convention.js", "-V"], {
    encoding: "utf8",
  });

  assert.equal(output.trim(), getCurrentVersion());
});

test("AJ CLI --version wins over commit options and works from another cwd", () => {
  const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), "convention-cli-version-cwd-"));

  try {
    const output = execFileSync(
      process.execPath,
      [path.resolve("bin/convention.js"), "--version", "--batch", "--step"],
      {
        cwd: tempCwd,
        encoding: "utf8",
      },
    );

    // --version은 commander parse 단계에서 종료되므로 Git 저장소 확인이나 batch/step commit flow를 실행하지 않습니다.
    assert.equal(output.trim(), getCurrentVersion());
    assert.doesNotMatch(output, /Git 저장소|Batch commit|commit completed/);
  } finally {
    fs.rmSync(tempCwd, { recursive: true, force: true });
  }
});
