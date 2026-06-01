import { parse } from 'node-html-parser';

const HOME_URL = 'https://unqx.uz/';
const SLUG_URL = 'https://unqx.uz/UNQ001';

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkHome(html) {
  const root = parse(html);
  const requiredSelectors = [
    '#home-profile-feed',
    '#latest-posts',
    '#latest-slack',
    '#weekly-top-views',
    '#wristband',
    '#faq',
    'footer',
  ];

  for (const selector of requiredSelectors) {
    assert(root.querySelector(selector), `Missing home section: ${selector}`);
  }

  assert(root.querySelectorAll('[data-home-post-card]').length > 0, 'No latest posts cards found');
  assert(root.querySelectorAll('.home-latest-card').length > 0, 'No latest created cards found');
  assert(root.querySelectorAll('.home-weekly-card').length > 0, 'No weekly top cards found');
  assert(root.querySelectorAll('.home-profile-marquee-item').length > 0, 'No featured profiles found');
  assert(/__UNQ_OFFICIAL_CLIENT_CONFIG/.test(html) || /UNQOfficialLetters/.test(html), 'Official config script marker missing');

  return {
    latestPosts: root.querySelectorAll('[data-home-post-card]').length,
    latestCreated: root.querySelectorAll('.home-latest-card').length,
    weeklyTop: root.querySelectorAll('.home-weekly-card').length,
    featuredProfiles: root.querySelectorAll('.home-profile-marquee-item').length,
    faq: root.querySelectorAll('#faq details').length,
  };
}

function checkSlug(html) {
  const match = html.match(/<script[^>]*id=["']card-view-data["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
  assert(match?.[1], 'Missing card-view-data JSON script');

  const payload = JSON.parse(match[1]);
  assert(payload?.card?.slug, 'Missing payload.card.slug');
  assert(payload?.shareUrl, 'Missing payload.shareUrl');
  assert(payload?.wall && Array.isArray(payload.wall.items), 'Missing payload.wall.items');
  assert(payload?.followSummary?.counts, 'Missing payload.followSummary.counts');
  assert(Object.prototype.hasOwnProperty.call(payload, 'paused'), 'Missing payload.paused');

  return {
    slug: payload.card.slug,
    wallItems: payload.wall.items.length,
    following: payload.followSummary.counts.following,
  };
}

async function main() {
  const [homeHtml, slugHtml] = await Promise.all([
    fetchText(HOME_URL),
    fetchText(SLUG_URL),
  ]);

  const home = checkHome(homeHtml);
  const slug = checkSlug(slugHtml);

  console.log('Public site parser smoke check passed.');
  console.log(JSON.stringify({ home, slug }, null, 2));
}

main().catch((error) => {
  console.error('Public site parser smoke check failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
