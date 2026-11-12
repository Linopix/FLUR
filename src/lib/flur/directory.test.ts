import assert from "node:assert/strict";
import test from "node:test";
import { filterDirectory, readNamedDirectory, readPublicDirectory, sortDirectory } from "./directory.ts";

test("public class payload keeps the short name Untis expects", () => {
  const items = readPublicDirectory(
    {
      classes: [
        { class: { id: 1, shortName: "10b", longName: "Klasse 10b", displayName: "10b" } },
        { class: { id: 2, shortName: "5a", longName: "Klasse 5a", displayName: "5a" } },
        { class: { id: 3, shortName: "10b", longName: "doppelt", displayName: "10b" } },
      ],
    },
    "class",
  );
  assert.deepEqual(
    items.map((item) => item.name),
    ["5a", "10b"],
  );
  assert.equal(items[1]?.longName, "Klasse 10b");
});

test("named teacher rows use the abbreviation as the value", () => {
  const items = readNamedDirectory([
    { id: 4, name: "MUE", longname: "Müller" },
    { id: 5, name: "", longName: "ohne Kürzel" },
  ]);
  assert.deepEqual(items, [{ name: "MUE", longName: "Müller" }]);
});

test("filter prefers an exact class, then the prefix, and ignores spaces", () => {
  const items = sortDirectory([
    { name: "10b", longName: "Klasse 10b" },
    { name: "10a", longName: "Klasse 10a" },
    { name: "Q1", longName: "Qualifikationsphase 1" },
    { name: "9b", longName: "Klasse 9b" },
  ]);
  const byNumber = filterDirectory(items, "10", 8);
  assert.deepEqual(
    byNumber.items.map((item) => item.name),
    ["10a", "10b"],
  );
  assert.equal(byNumber.more, 0);
  assert.equal(filterDirectory(items, "10 B", 8).items[0]?.name, "10b");
  assert.equal(filterDirectory(items, "quali", 8).items[0]?.name, "Q1");
  assert.deepEqual(
    filterDirectory(
      [
        { name: "1ACB", longName: "Angewandte Chemie, Bachelor" },
        { name: "IRM1A", longName: "Retail" },
      ],
      "1a",
      8,
    ).items.map((item) => item.name),
    ["1ACB"],
  );
  assert.equal(
    filterDirectory([{ name: "1ACB", longName: "Angewandte Chemie, Bachelor" }], "chemie", 8).items[0]?.name,
    "1ACB",
  );
});

test("filter pages a long list and sorts an empty query numerically", () => {
  const items = [
    { name: "10a", longName: "10a" },
    { name: "2a", longName: "2a" },
    { name: "2b", longName: "2b" },
  ];
  const page = filterDirectory(items, "", 2);
  assert.deepEqual(
    page.items.map((item) => item.name),
    ["2a", "2b"],
  );
  assert.equal(page.more, 1);
  assert.equal(filterDirectory(items, "zzz", 8).items.length, 0);
});
