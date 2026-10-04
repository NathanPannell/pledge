---
name: Spare CAD
description: A small, calm CAD pledge prompt beside an AI purchase.
colors:
  ink: "#182235"
  muted: "#586378"
  blue: "#264dce"
  blue-dark: "#173baf"
  red: "#e94732"
  paper: "#fff"
  ground: "#f7f8fa"
  line: "#e0e5ee"
  green: "#1c6952"
  success-ground: "#eaf4ee"
  field-stroke: "#bec8d8"
  quiet-hover: "#f0f3f8"
  error: "#9e3028"
typography:
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-.025em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  action:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 650
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11px"
    lineHeight: 1.65
  brand:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "22px"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "-.035em"
  field:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
rounded:
  field: "7px"
  action: "8px"
  surface: "14px"
  circle: "50%"
spacing:
  compact: "8px"
  small: "12px"
  copy-gap: "14px"
  mobile-inset: "22px"
  extension-inset: "24px"
  surface-inset: "26px"
  page-inset: "28px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "12px 15px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.blue-dark}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.action}"
    width: "100%"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.field}"
    width: "44px"
    height: "44px"
  prompt:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "{spacing.surface-inset}"
  cad-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "9px"
    width: "100%"
---

# Design System: Spare CAD

## Overview

**Creative North Star: "The Little Question"**

Spare's approved identity makes a small request feel calm and precise. Navy copy, cobalt actions and a tomato wordmark dot frame Newsreader questions; DM Sans handles the facts and controls. White surfaces, compact content and a single clear primary action keep the reading burden small.

The north star names the existing compact question; it introduces no new direction. This source extraction covers `public/style.css`, `public/index.html`, `public/app.js`, `extension/content.js`, `extension/popup.css` and `extension/popup.js`. The approved surface contract is `.impeccable/surfaces/public-index-html.md`.

**Key Characteristics:**

- Quiet white surfaces on cool gray ground.
- Newsreader for the human question; DM Sans for facts and actions.
- Generous action targets within a compact prompt.
- The same small surface changes from question to short confirmation.

## Colors

Cobalt carries action and focus; navy carries content. Muted copy and pale neutral layers keep supporting information quiet. The frontmatter holds the normative color values.

### Primary

- **Cobalt:** primary actions, links, field carets and keyboard focus.
- **Deep cobalt:** primary hover states on the website and injected prompt.

### Secondary

- **Tomato:** the small dot in the Spare wordmark.
- **Calm green:** success checks, paired with pale success ground.

### Neutral

- **Navy ink:** questions, monetary facts and strong supporting text.
- **Slate copy:** explanations, quiet actions, labels and ledger detail.
- **White paper:** prompt, website stage and extension surfaces.
- **Cool ground:** website background.
- **Pale line:** stage border, receipt rules and ledger dividers.
- **Field stroke:** input boundaries across website and extension.
- **Quiet hover:** website quiet, icon and text-control hover fills.
- **Brick error:** recoverable failures; the website also adds a pale red inset background.

**The Action Color Rule.** Keep cobalt on actions and keyboard focus. Preserve the tomato wordmark detail.

## Typography

**Display Font:** Newsreader, with Georgia and serif fallbacks.

**Body Font:** DM Sans, with a sans-serif fallback. Both families ship as local WOFF2 assets on the website and in the extension.

Newsreader gives the question a human voice. DM Sans keeps totals, instructions and controls practical. The website receipt heading stays sans-serif so the Spare question has its own emphasis.

### Hierarchy

- **Headline:** the frontmatter role is the desktop website prompt. It becomes (30px) on phones. The injected extension uses (30px); its popup uses (28px) with (1.15) line height. The installation dialog uses (29px).
- **Body:** website descriptions use the frontmatter role, becoming (13px) on phones; extension descriptions use (13px).
- **Action:** website primary buttons use the frontmatter role; extension actions use (13px). Quiet website actions also use (13px).
- **Label:** small explanations, balance captions and metadata. CAD correction labels use (12px).
- **Brand:** compact website prompt wordmark uses the frontmatter role. Website header uses (25px); extension popup uses (24px). Extension wordmarks use weight (750) and tracking (-.03em).
- **Field:** readable (16px) input text for CAD correction and pairing.

**The Question Rule.** Keep Newsreader on questions and short state headings; use DM Sans for amounts, controls and receipt facts. Preserve tabular numerals on website receipt, balance and payment amounts.

## Layout

Website header maximum width is (1180px), height (88px), with the frontmatter page inset. Main content maximum width is (1120px). The white stage pairs a flexible receipt column with a (390px) prompt column, (64px) gap and (38px 50px) padding. The prompt uses the frontmatter surface inset.

At (950px), the stage uses a (360px) prompt column, (30px) gap and (30px) padding. At (720px), the compact receipt stacks immediately above the prompt. Header height becomes (72px), main horizontal padding (16px), and the stage loses its border and white background. Stage and prompt use the mobile inset. The receipt check and extended note are hidden to shorten the receipt. Demo controls wrap below the stage; ledger and installation remain separate surfaces.

The OpenRouter-only injected Chrome prompt sits at the lower right, with (24px) offsets, width (360px), maximum width `calc(100vw - 32px)` and the extension inset. The browser action popup has width (320px) and the same inset. They express the same visual language through distinct hosts. The installation dialog is at most (480px) wide and bounded to the viewport by `calc(100% - 32px)` width and `calc(100dvh - 32px)` height. Spacing is component-specific rather than a universal mathematical scale.

## Elevation & Depth

The receipt stage is flat with a fine border. The question floats above it with paired soft shadows. The injected extension increases shadow strength to remain distinct from OpenRouter billing pages. The installation dialog uses a stronger shadow and translucent navy backdrop. Exact elevation values live in `.impeccable/design.json`.

Website prompt arrival fades and rises over (.22s) with `ease-out`; button background changes take (.16s). Reduced-motion preference removes website animations and transitions. Extension surfaces have no authored entrance animation.

## Shapes

Surfaces have gently curved corners; controls and fields use tighter frontmatter radii. Success checks sit inside circles. Fine borders establish receipt structure and input boundaries; floating prompts have no border. Website close and success glyphs use round-ended SVG strokes; the injected prompt uses a text close mark.

## Components

### Buttons

Primary actions are full-width cobalt with white text and minimum height (48px). Website and injected-prompt hover deepens the fill; the extension popup has no authored hover-color change. Disabled actions lower opacity to (.65); website and injected-prompt processing controls use a wait cursor.

Quiet actions are muted on transparent backgrounds with minimum height (44px). Website quiet, text and icon controls gain a pale hover fill. Icon controls are (44px) square. Extension quiet controls have no authored quiet-hover fill.

**The Focus Rule.** Preserve the cobalt focus outline (3px), offset (3px), on controls that define it. The website covers buttons, links, disclosure summaries and inputs; the extension covers buttons and inputs.

### Cards / Containers

The prompt holds wordmark, dismissal, serif question, brief explanation and one primary action. Content changes for saved pledges, payment threshold, payment checking, confirmed payment and dismissal. The website also supplies no-round-up and recoverable-error states. These are content states inside the same surface. On OpenRouter, changed detected totals replace the current unapproved offer; whole or invalid CAD totals remove that offer.

### Inputs / Fields

CAD correction fields use a fine field stroke, gently curved corners, (16px) text and minimum height (44px). Website correction label and input sit beside a text action; the injected prompt stacks correction label, field and quiet update action. Extension popup uses the field language for pairing. Website errors use a small pale red panel; extension errors use brick-colored text.

### Navigation

The website header contains a wordmark link, small sandbox label and quiet extension-installation action. It tightens on phones. The current site has no multi-item navigation or selected navigation state.

### Disclosure and balance

Centered small disclosures reveal conversion explanation and CAD correction within the prompt. A fine top rule separates the pending-balance caption. Outside the prompt, an expandable ledger uses subtle row dividers and aligned amounts. Disclosure summaries have minimum height (44px).

### Success mark and installation dialog

A green check on pale green marks a saved pledge or confirmed test payment on the website. The installation dialog uses the same serif heading, white surface, quiet close and cobalt action. Pairing codes use a pale inset block with wrapping for long values.

## Do's and Don'ts

### Do:

- **Do** preserve the approved font pairing, wordmark and action palette.
- **Do** keep the primary action visually singular and cancellation easy to find.
- **Do** preserve keyboard focus, mobile reachability and readable error states.
- **Do** keep supporting totals and instructions in DM Sans, with serif emphasis reserved for questions and state headings.

### Don't:

- **Don't** add visual decoration that increases the prompt's reading burden.
- **Don't** introduce a new identity when extending these surfaces.
- **Don't** copy the older quick-demo's simulated browser chrome, saved-card component or breakpoints into this CAD system.

Product and payment rules belong in `PRODUCT.md`; page composition belongs in the surface contract. This document records source implementation and does not certify browser or provider behavior.

The website explicitly labels itself a web preview and makes “Install in Chrome” the setup action. The setup dialog explains that the extension places its prompt directly in OpenRouter’s Add Credits window; Stripe handles the separate payment after the C$5 threshold.
