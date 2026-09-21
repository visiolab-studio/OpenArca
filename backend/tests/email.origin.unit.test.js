const test = require("node:test");
const assert = require("node:assert/strict");
const { buildEmailHtml } = require("../services/email");

const SETTINGS = { app_name: "OpenArca", app_url: "https://canonical.example.test" };

function render(origin) {
  return buildEmailHtml({
    subject: "Subject",
    text: "Body",
    settings: SETTINGS,
    lang: "en",
    origin
  });
}

test("an explicit origin wins over the stored app_url", () => {
  const html = render("https://pomoc.example.test");

  assert.ok(html.includes("https://pomoc.example.test"));
  assert.ok(!html.includes("canonical.example.test"));
});

test("without an origin the stored app_url is used", () => {
  const html = render(undefined);
  assert.ok(html.includes("https://canonical.example.test"));
});

test("the profile link follows the same origin as the rest of the mail", () => {
  // A mail whose body points at one host and whose settings link points at
  // another is the kind of inconsistency that trains people to ignore links.
  const html = render("https://pomoc.example.test");
  assert.ok(html.includes("https://pomoc.example.test/profile#notifications"));
});

test("a trailing slash on the origin does not produce a double slash", () => {
  const html = render("https://pomoc.example.test/");
  assert.ok(!html.includes("pomoc.example.test//"));
});
