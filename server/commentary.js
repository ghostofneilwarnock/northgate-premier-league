/**
 * commentary.js
 *
 * Claude API integration for AI-generated match commentary.
 *
 * Your matchEngine.js already writes rich templated commentary text for every
 * event (goals, saves, cards, etc — see the `C` bank in matchEngine.js). This
 * module adds THREE things on top of that, using the Claude API:
 *
 *   1. generateMatchIntro   — a fresh pre-match blurb (kickoff already has one,
 *                              this is a richer alternative/addition)
 *   2. generateCommentary   — one extra "colour" line reacting to a big moment
 *                              (goals + red cards by default — see COMMENTARY_EVENT_TYPES
 *                              in index.js), layered ON TOP of the banked text
 *   3. generateMatchSummary — a full-time recap, using the banked event text
 *                              as its source material
 *
 * HOW TO INTEGRATE: see INTEGRATION.md / the wired index.js.
 * Requires ANTHROPIC_API_KEY to be set in Render's environment variables.
 * All functions fail silently (return null) on API errors — a hiccup here
 * should never break or stall a live match.
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a sharp, slightly wry football (soccer) commentator for a
text-based league called the Northgate Premier League (NPL). Write like a real match
commentator: concise, vivid, present-tense where it fits. No emojis. No hashtags.
Never break character or mention you are an AI. Never repeat lines you've already been shown.`;

/**
 * Generate a short pre-match intro blurb.
 *
 * @param {Object} ctx
 * @param {string} ctx.homeTeam
 * @param {string} ctx.awayTeam
 * @param {string} [ctx.stadium]
 * @param {number} ctx.matchdayNumber
 * @param {string} [ctx.stakes] - e.g. "top of the table" or "relegation scrap"
 */
async function generateMatchIntro(ctx) {
  const prompt = `Matchday ${ctx.matchdayNumber}: ${ctx.homeTeam} host ${ctx.awayTeam}${ctx.stadium ? ` at ${ctx.stadium}` : ''}.
${ctx.stakes ? `Context: ${ctx.stakes}.` : ''}

Write a 2-3 sentence pre-match intro. Set the scene. Mention the stakes if relevant
(e.g. top of the table, relegation scrap). Keep it tight.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.text?.trim() || null;
  } catch (err) {
    console.error('[commentary] Intro API error:', err.message);
    return null;
  }
}

/**
 * Generate ONE extra line of colour commentary reacting to a significant event.
 * Feeds in the banked text your matchEngine already generated for this event,
 * and asks Claude for a fresh reaction rather than a restatement.
 *
 * @param {Object} event - A raw event object from matchEngine (has .minute, .type,
 *                          .side, .text, and event-specific fields like .scorerId)
 * @param {Object} ctx - { homeTeam, awayTeam, matchdayNumber }
 */
async function generateCommentary(event, ctx) {
  const prompt = `${event.minute}' — ${ctx.homeTeam} vs ${ctx.awayTeam}

What just happened: "${event.text}"

Write ONE short additional line of live commentary reacting to this moment — your own
take, don't just restate the line above. Punchy, present-tense, no more than 20 words.
No preamble, just the line.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 60,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.text?.trim() || null;
  } catch (err) {
    console.error('[commentary] Event API error:', err.message);
    return null;
  }
}

/**
 * Generate a post-match summary using the match's own banked event text
 * as source material (goals and red cards, in order).
 *
 * @param {Object} ctx - { homeTeam, awayTeam, homeScore, awayScore, matchdayNumber }
 * @param {Array} events - Full events array from matchEngine's preGenerateEvents()
 */
async function generateMatchSummary(ctx, events) {
  const scoreStr = `${ctx.homeTeam} ${ctx.homeScore}-${ctx.awayScore} ${ctx.awayTeam}`;

  const keyMoments = events
    .filter(e => ['goal', 'red'].includes(e.type))
    .map(e => `${e.minute}' - ${e.text}`)
    .join('\n');

  const prompt = `Final score: ${scoreStr}

Key moments:
${keyMoments || 'A fairly uneventful match.'}

Write a 2-3 sentence post-match summary. Be matter-of-fact and slightly editorial.
Mention the result's significance if obvious.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.text?.trim() || null;
  } catch (err) {
    console.error('[commentary] Summary API error:', err.message);
    return null;
  }
}

module.exports = {
  generateMatchIntro,
  generateCommentary,
  generateMatchSummary,
};
