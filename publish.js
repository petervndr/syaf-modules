#!/usr/bin/env node
/**
 * publish.js — publish a module artifact to classroom.joinsyaf.com
 *
 * Usage:
 *   node publish.js --slug pricing --source /path/to/artifact.html
 *
 * What it does:
 *   1. Copies the artifact to {slug}/index.html
 *   2. Flips the landing page card from "Coming Soon" → "Available"
 *   3. git commit + push → Vercel auto-deploys in ~30s
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(process.argv[1]);

const MODULES = {
  'mindset':            { num: '01', title: 'Mindset & Theory of Constraints' },
  'pricing':            { num: '02', title: 'Pricing Fundamentals' },
  'avatar':             { num: '03', title: 'Identifying Your Client Avatar' },
  'signature-offer':    { num: '04', title: 'Creating Your Signature Offer' },
  'problem-solution':   { num: '05', title: 'Problem-Solution Mapping' },
  'marketing-strategy': { num: '06', title: 'Marketing Strategy Overview' },
  'marketing-tools':    { num: '07', title: "Marketing Tools You'll Need" },
  'affiliate-outreach': { num: '08', title: 'Outreach to Affiliate Partners' },
  'sales-process':      { num: '09', title: 'Sales Process Overview' },
  'capturing-proof':    { num: '10', title: 'How to Capture Proof' },
  'pre-call-questions': { num: '11', title: 'Asking the Right Questions Pre-Call' },
  'sales-script':       { num: '12', title: 'The 2-Minute Sales Script' },
  'follow-up':          { num: '13', title: 'How to Follow Up Without Sounding Needy' },
};

// ── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const slug   = get('--slug');
const source = get('--source');

if (!slug || !source) {
  console.error('Usage: node publish.js --slug <slug> --source <path/to/artifact.html>');
  console.error('\nValid slugs:', Object.keys(MODULES).join(', '));
  process.exit(1);
}

const mod = MODULES[slug];
if (!mod) {
  console.error(`Unknown slug: "${slug}"`);
  console.error('Valid slugs:', Object.keys(MODULES).join(', '));
  process.exit(1);
}

if (!fs.existsSync(source)) {
  console.error(`Source file not found: ${source}`);
  process.exit(1);
}

// ── Step 1: Copy artifact ─────────────────────────────────────────────────────
const destDir = path.join(REPO, slug);
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(source, path.join(destDir, 'index.html'));
console.log(`✓ Copied artifact → ${slug}/index.html`);

// ── Step 2: Update landing page ───────────────────────────────────────────────
const indexPath = path.join(REPO, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// Each coming-soon card has a unique module number badge.
// We find the card block by splitting on that badge and patching the opening anchor + status badge.

const numBadge  = `<span class="module-num">${mod.num}</span>`;
const cardStart = html.indexOf(numBadge);

if (cardStart === -1) {
  console.error(`Could not find module ${mod.num} card in index.html`);
  process.exit(1);
}

// Look back from numBadge to find the opening <a ... > of this card
const beforeBadge = html.slice(0, cardStart);
const anchorStart = beforeBadge.lastIndexOf('<a ');

// Check if this card is already published
const anchorTag = html.slice(anchorStart, cardStart);
if (!anchorTag.includes('coming-soon')) {
  console.log(`Module ${mod.num} (${mod.title}) is already published. Nothing to update on the landing page.`);
} else {
  // Fix the anchor: remove coming-soon class, set real href
  const oldAnchor = html.slice(anchorStart, cardStart);
  const newAnchor = oldAnchor
    .replace('module-card coming-soon', 'module-card')
    .replace('href="#"', `href="/${slug}"`);
  html = html.slice(0, anchorStart) + newAnchor + html.slice(cardStart);

  // Fix the status badge — find the first occurrence after the anchor start
  const afterAnchor = html.indexOf(numBadge); // re-find after replacement
  const badgeSearch = html.indexOf('<span class="status-badge soon">Coming Soon</span>', afterAnchor);
  if (badgeSearch !== -1) {
    html = html.slice(0, badgeSearch)
      + '<span class="status-badge available">Available</span>'
      + html.slice(badgeSearch + '<span class="status-badge soon">Coming Soon</span>'.length);
  }

  // Add "Start →" CTA to the card footer
  // Find the card-footer closing tag after this card's num badge
  const footerSearchFrom = html.indexOf(numBadge);
  const footerClose = html.indexOf('</div>\n    </a>', footerSearchFrom);
  if (footerClose !== -1) {
    html = html.slice(0, footerClose)
      + '\n        <span class="card-cta">Start →</span>\n      </div>\n    </a>'
      + html.slice(footerClose + '</div>\n    </a>'.length);
  }

  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log(`✓ Landing page updated — module ${mod.num} is now Available`);
}

// ── Step 3: Commit and push ───────────────────────────────────────────────────
try {
  execSync(
    `cd "${REPO}" && git add . && git commit -m "Publish module ${mod.num}: ${mod.title}" && git push`,
    { stdio: 'inherit', shell: '/bin/zsh' }
  );
  console.log(`\n✓ Deployed! Live in ~30s at https://classroom.joinsyaf.com/${slug}`);
} catch (err) {
  console.error('Git error:', err.message);
  process.exit(1);
}
