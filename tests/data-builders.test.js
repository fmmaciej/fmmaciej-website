const test = require("node:test");
const assert = require("node:assert/strict");

const buildBlogArchive = require("../src/_lib/blog/buildBlogArchive.js");
const buildEventData = require("../src/_lib/music/buildEventData.js");
const buildMixData = require("../src/_lib/music/buildMixData.js");
const buildPhotoData = require("../src/_lib/music/buildPhotoData.js");

function media(id, groupId, seq, alt = null) {
  return {
    id,
    groupId,
    seq,
    alt,
    image: {
      variants: {
        "480": { src: `${id}-480.webp`, width: 480, height: 300 },
        "960": { src: `${id}-960.webp`, width: 960, height: 600 },
        "1600": { src: `${id}-1600.webp`, width: 1600, height: 1000 }
      }
    }
  };
}

test("buildBlogArchive groups years and months without mutating posts", () => {
  const posts = [
    {
      date: new Date("2025-12-20T12:00:00Z"),
      url: "/blog/older/",
      data: { title: "Older", description: "Old post", tags: ["old"] }
    },
    {
      date: new Date("2026-01-10T12:00:00Z"),
      url: "/blog/january/",
      data: { title: "January" }
    },
    {
      date: new Date("2026-03-10T12:00:00Z"),
      url: "/blog/march/",
      data: { title: "March", tags: ["new"] }
    }
  ];
  const before = structuredClone(posts);

  const archive = buildBlogArchive(posts);

  assert.deepEqual(posts, before);
  assert.deepEqual(archive.map((year) => year.year), [2026, 2025]);
  assert.deepEqual(archive[0].months.map((month) => month.name), ["March", "January"]);
  assert.equal(archive[0].count, 2);
  assert.deepEqual(archive[0].months[0].items[0], {
    title: "March",
    url: "/blog/march/",
    date: posts[2].date,
    description: "",
    tags: ["new"]
  });
});

test("buildEventData resolves media and builds sorted archive groups", () => {
  const catalog = {
    defaults: { imagePreset: "upcoming-default" },
    items: [
      {
        id: "20270102__later",
        slug: "later",
        date: "2027-01-02",
        section: "upcoming",
        title: "Later",
        place: null,
        coverId: null
      },
      {
        id: "20191231__old_event",
        slug: "old_event",
        date: "2019-12-31",
        section: "archive",
        title: "Old Event",
        place: "Club",
        coverId: "20191231__old_event__01"
      },
      {
        id: "20250101__empty",
        slug: "empty",
        date: "2025-01-01",
        section: "archive",
        title: "Empty",
        place: null,
        coverId: null
      },
      {
        id: "20270101__sooner",
        slug: "sooner",
        date: "2027-01-01",
        section: "upcoming",
        title: "Sooner",
        place: null,
        coverId: null
      }
    ],
    media: [
      media("20191231__old_event__02", "20191231__old_event", 2),
      media("20191231__old_event__01", "20191231__old_event", 1, "Cover")
    ]
  };
  const before = structuredClone(catalog);

  const data = buildEventData(catalog);

  assert.deepEqual(catalog, before);
  assert.deepEqual(data.upcoming.map((event) => event.id), ["20270101__sooner", "20270102__later"]);
  assert.deepEqual(data.archive.map((event) => event.id), ["20250101__empty", "20191231__old_event"]);
  assert.deepEqual(data.all, [...data.upcoming, ...data.archive]);
  assert.deepEqual(data.years, [2025, 2019]);
  assert.deepEqual(data.decades.map((group) => group.slug), ["d-2020", "d-2010"]);
  assert.equal(data.groups[1].mediaCount, 2);

  const event = data.archive[1];
  assert.deepEqual(event.items.map((item) => item.seq), [1, 2]);
  assert.equal(event.cover.thumb480, "/assets/music/events/generated/20191231__old_event__01-480.webp");
  assert.equal(event.path, "/music/events/2019-12-31-old-event/");
  assert.equal(event.listHref, "/music/events/#y-2019");

  const empty = data.archive[0];
  assert.equal(empty.count, 0);
  assert.equal(empty.items[0].fallback, true);
  assert.equal(empty.cover.alt, "Upcoming event");
});

test("buildMixData formats dates and builds planned, latest, and platform groups", () => {
  const published = [
    ["one", "2020-01-01", "YouTube"],
    ["two", "2021-02", "Mixcloud"],
    ["three", "2022", null],
    ["four", "2023-04-04", "YouTube"],
    ["five", "2024-05-05", "Mixcloud"],
    ["six", "2025-06-06", "YouTube"]
  ].map(([id, date, platform]) => ({
    id,
    title: id,
    date,
    dateEnd: id === "three" ? "2023" : null,
    status: "published",
    platform,
    url: `https://example.com/${id}`,
    imageId: id === "six" ? "mix__six__01" : null
  }));
  const catalog = {
    defaults: {
      imagePreset: "upcoming-default",
      platformOrder: ["Mixcloud", "YouTube", "Other"]
    },
    items: [
      ...published,
      {
        id: "planned-later",
        title: "Planned later",
        date: "2027-02",
        dateEnd: null,
        status: "planned",
        platform: null,
        url: null,
        imageId: null
      },
      {
        id: "planned-sooner",
        title: "Planned sooner",
        date: "2027-01-02",
        dateEnd: null,
        status: "planned",
        platform: null,
        url: null,
        imageId: null
      }
    ],
    media: [media("mix__six__01", "mix__six", 1, "Six image")]
  };
  const before = structuredClone(catalog);

  const data = buildMixData(catalog);

  assert.deepEqual(catalog, before);
  assert.deepEqual(data.upcomingItems.map((item) => item.id), ["planned-sooner", "planned-later"]);
  assert.deepEqual(data.latestItems.map((item) => item.id), ["six", "five", "four", "three", "two"]);
  assert.deepEqual(data.groups.map((group) => group.slug), ["mixcloud", "youtube", "other"]);
  assert.equal(data.archiveItems.find((item) => item.id === "one").displayDate, "01.01.2020");
  assert.equal(data.archiveItems.find((item) => item.id === "two").displayDate, "02.2021");
  assert.equal(data.archiveItems.find((item) => item.id === "three").displayDate, "2022–2023");
  assert.equal(data.latestItems[0].img, "/assets/music/mixes/generated/mix__six__01-960.webp");
  assert.equal(data.latestItems[0].alt, "Six image");
  assert.equal(data.upcomingItems[0].img, "/assets/music/fallbacks/upcoming.png");
});

test("buildPhotoData normalizes authors, filters empty sets, and groups years", () => {
  const catalog = {
    defaults: {},
    items: [
      {
        id: "20230101__older",
        slug: "older",
        date: "2023-01-01",
        title: "Older",
        place: null,
        author: {}
      },
      {
        id: "20240202__newer",
        slug: "newer",
        date: "2024-02-02",
        title: "Newer",
        place: "Club",
        author: {
          name: "Photographer",
          instagram: "https://www.instagram.com/photo/",
          facebook: "facebook.com/photo",
          email: "photo@example.com"
        }
      },
      {
        id: "20250101__empty",
        slug: "empty",
        date: "2025-01-01",
        title: "Empty",
        place: null,
        author: {}
      }
    ],
    media: [
      media("20240202__newer__02", "20240202__newer", 2),
      media("20230101__older__01", "20230101__older", 1),
      media("20240202__newer__01", "20240202__newer", 1)
    ]
  };
  const before = structuredClone(catalog);

  const data = buildPhotoData(catalog);

  assert.deepEqual(catalog, before);
  assert.deepEqual(data.sets.map((set) => set.id), ["20240202__newer", "20230101__older"]);
  assert.deepEqual(data.sets[0].photos.map((photo) => photo.seq), [1, 2]);
  assert.deepEqual(data.sets[0].authorInfo, {
    name: "Photographer",
    instagram: { href: "https://instagram.com/photo", label: "@photo" },
    facebook: { href: "https://facebook.com/photo", label: "facebook.com/photo" },
    email: { href: "mailto:photo@example.com", label: "photo@example.com" }
  });
  assert.deepEqual(data.years, [2024, 2023]);
  assert.equal(data.groups[0].count, 1);
  assert.equal(data.groups[0].photoCount, 2);
});

test("Eleventy adapters expose ready view models and preserve allEvents", () => {
  const eventData = require("../src/_data/eventData.js");
  const mixData = require("../src/_data/mixData.js");
  const photoData = require("../src/_data/photoData.js");
  const allEvents = require("../src/_data/allEvents.js");

  assert.equal(typeof eventData, "object");
  assert.equal(typeof mixData, "object");
  assert.equal(typeof photoData, "object");
  assert.ok(Array.isArray(eventData.decades));
  assert.ok(Array.isArray(mixData.latestItems));
  assert.ok(Array.isArray(photoData.groups));
  assert.strictEqual(allEvents, eventData.all);
});
