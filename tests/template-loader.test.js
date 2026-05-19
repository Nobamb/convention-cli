import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DEFAULT_TEMPLATE, loadTemplate, loadValidatedTemplate } from "../src/templates/loader.js";

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value), "utf8");
}

function withTempHome(callback) {
  const tempHome = makeTempDir("convention-cli-template-home-");
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;

  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  try {
    return callback(tempHome);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    if (previousUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = previousUserProfile;
    }

    fs.rmSync(tempHome, { recursive: true, force: true });
  }
}

function withTempProject(callback) {
  const projectRoot = makeTempDir("convention-cli-template-project-");

  try {
    return callback(projectRoot);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

function createLogger() {
  const warnings = [];

  return {
    logger: {
      warn(message) {
        warnings.push(message);
      },
    },
    warnings,
  };
}

test("loadTemplate prefers project .convention/template.json over other candidates", () => {
  withTempHome((home) => {
    withTempProject((projectRoot) => {
      const projectTemplatePath = path.join(projectRoot, ".convention", "template.json");
      const projectRcPath = path.join(projectRoot, ".conventionrc");
      const userTemplatePath = path.join(home, ".config", "convention", "template.json");

      writeJson(projectTemplatePath, { name: "project-template" });
      writeJson(projectRcPath, { name: "project-rc" });
      writeJson(userTemplatePath, { name: "user-template" });

      const result = loadTemplate({ projectRoot });

      assert.deepEqual(result.template, { name: "project-template" });
      assert.equal(result.source, "project-template");
      assert.equal(result.path, projectTemplatePath);
    });
  });
});

test("loadTemplate falls back to project .conventionrc when project template is missing", () => {
  withTempHome((home) => {
    withTempProject((projectRoot) => {
      const projectRcPath = path.join(projectRoot, ".conventionrc");
      const userTemplatePath = path.join(home, ".config", "convention", "template.json");

      writeJson(projectRcPath, { name: "project-rc" });
      writeJson(userTemplatePath, { name: "user-template" });

      const result = loadTemplate({ projectRoot });

      assert.deepEqual(result.template, { name: "project-rc" });
      assert.equal(result.source, "project-rc");
      assert.equal(result.path, projectRcPath);
    });
  });
});

test("loadTemplate uses user template when project candidates are absent", () => {
  withTempHome((home) => {
    withTempProject((projectRoot) => {
      const userTemplatePath = path.join(home, ".config", "convention", "template.json");

      writeJson(userTemplatePath, { name: "user-template" });

      const result = loadTemplate({ projectRoot });

      assert.deepEqual(result.template, { name: "user-template" });
      assert.equal(result.source, "user-template");
      assert.equal(result.path, userTemplatePath);
    });
  });
});

test("loadTemplate returns default template when no candidate exists", () => {
  withTempHome(() => {
    withTempProject((projectRoot) => {
      const { logger, warnings } = createLogger();
      const result = loadTemplate({ projectRoot, logger });

      assert.equal(result.source, "default");
      assert.equal(result.path, null);
      assert.equal(result.template.name, DEFAULT_TEMPLATE.name);
      assert.equal(result.template.language, "ko");
      assert.equal(result.template.format, "{type}: {message}");
      assert.deepEqual(result.template.types, ["feat", "fix", "refactor", "docs", "style", "test", "chore"]);
      assert.deepEqual(result.template.rules, {
        maxLength: 72,
        requireScope: false,
        allowEmoji: false,
      });
      assert.deepEqual(warnings, []);
    });
  });
});

test("loadTemplate skips invalid project JSON and loads the next valid candidate", () => {
  withTempHome(() => {
    withTempProject((projectRoot) => {
      const projectTemplatePath = path.join(projectRoot, ".convention", "template.json");
      const projectRcPath = path.join(projectRoot, ".conventionrc");
      const { logger, warnings } = createLogger();

      fs.mkdirSync(path.dirname(projectTemplatePath), { recursive: true });
      fs.writeFileSync(projectTemplatePath, "{\"token\":\"SECRET_VALUE\",", "utf8");
      writeJson(projectRcPath, { name: "project-rc" });

      const result = loadTemplate({ projectRoot, logger });

      assert.deepEqual(result.template, { name: "project-rc" });
      assert.equal(result.source, "project-rc");
      assert.equal(result.path, projectRcPath);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /source=project-template/);
      assert.match(warnings[0], /reason=template file could not be loaded/);
      assert.doesNotMatch(warnings[0], /SECRET_VALUE|token/);
    });
  });
});

test("loadTemplate skips non-object JSON values and falls back to user template", () => {
  withTempHome((home) => {
    withTempProject((projectRoot) => {
      const projectTemplatePath = path.join(projectRoot, ".convention", "template.json");
      const projectRcPath = path.join(projectRoot, ".conventionrc");
      const userTemplatePath = path.join(home, ".config", "convention", "template.json");
      const { logger, warnings } = createLogger();

      writeJson(projectTemplatePath, ["feat"]);
      writeJson(projectRcPath, null);
      writeJson(userTemplatePath, { name: "user-template" });

      const result = loadTemplate({ projectRoot, logger });

      assert.deepEqual(result.template, { name: "user-template" });
      assert.equal(result.source, "user-template");
      assert.equal(result.path, userTemplatePath);
      assert.equal(warnings.length, 2);
      assert.match(warnings[0], /template must be a JSON object/);
      assert.match(warnings[1], /template must be a JSON object/);
    });
  });
});

test("loadTemplate returns default when every existing candidate is invalid", () => {
  withTempHome((home) => {
    withTempProject((projectRoot) => {
      const projectTemplatePath = path.join(projectRoot, ".convention", "template.json");
      const projectRcPath = path.join(projectRoot, ".conventionrc");
      const userTemplatePath = path.join(home, ".config", "convention", "template.json");

      fs.mkdirSync(path.dirname(projectTemplatePath), { recursive: true });
      fs.writeFileSync(projectTemplatePath, "", "utf8");
      fs.writeFileSync(projectRcPath, "   ", "utf8");
      fs.mkdirSync(path.dirname(userTemplatePath), { recursive: true });
      fs.writeFileSync(userTemplatePath, "\"not-object\"", "utf8");

      const result = loadTemplate({ projectRoot });

      assert.equal(result.source, "default");
      assert.equal(result.path, null);
      assert.equal(result.template.name, "default");
    });
  });
});

test("loadTemplate only uses the fixed candidate paths", () => {
  withTempHome((home) => {
    withTempProject((projectRoot) => {
      const ignoredPath = path.join(projectRoot, "..", "template.json");
      const userTemplatePath = path.join(home, ".config", "convention", "template.json");

      writeJson(ignoredPath, { name: "ignored-external-template" });
      writeJson(userTemplatePath, { name: "user-template" });

      const result = loadTemplate({
        projectRoot,
        templatePath: ignoredPath,
      });

      assert.deepEqual(result.template, { name: "user-template" });
      assert.equal(result.source, "user-template");
      assert.equal(result.path, userTemplatePath);
    });
  });
});

test("loadValidatedTemplate skips schema-invalid project template and uses next valid candidate", () => {
  withTempHome((home) => {
    withTempProject((projectRoot) => {
      const projectTemplatePath = path.join(projectRoot, ".convention", "template.json");
      const userTemplatePath = path.join(home, ".config", "convention", "template.json");

      writeJson(projectTemplatePath, {
        name: "broken",
        language: "ko",
        format: "{type}",
        types: ["feature"],
        rules: {
          maxLength: 72,
          requireScope: false,
          allowEmoji: false,
        },
      });
      writeJson(userTemplatePath, {
        name: "user-template",
        language: "en",
        format: "{type}: {message}",
        types: ["docs"],
        rules: {
          maxLength: 50,
          requireScope: false,
          allowEmoji: false,
        },
      });

      const result = loadValidatedTemplate({ projectRoot });

      assert.equal(result.valid, true);
      assert.equal(result.fallback, true);
      assert.equal(result.source, "user-template");
      assert.equal(result.template.name, "user-template");
      assert.equal(result.template.language, "en");
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0], /source=project-template/);
      assert.match(result.warnings[0], /types must contain only supported commit types/);
      assert.doesNotMatch(result.warnings[0], /feature/);
    });
  });
});
