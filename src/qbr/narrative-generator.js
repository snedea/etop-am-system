const OpenAI = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Narrative Generator
 * Generates AI-powered narratives using OpenAI GPT-4 with strict citation requirements
 */

class NarrativeGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: config.openai.timeout
    });
    this.model = config.openai.model;
  }

  /**
   * Generate complete narrative from scores and data
   * @param {Object} input - Scores and normalized data
   * @returns {Promise<Narrative>}
   */
  async generateNarrative(input) {
    logger.info(`Generating narrative for client ${input.client.name}`);

    try {
      // Run all narrative generation jobs in parallel
      const [trends, executiveSummary, recommendations, discussionPoints] = await Promise.all([
        this.spotTrends(input),
        this.writeExecutiveSummary(input),
        this.synthesizeActions(input),
        this.prepareDiscussionPoints(input)
      ]);

      // Validate all recommendations have citations
      this.validateCitations(recommendations, input);

      logger.info(`Narrative generated successfully for client ${input.client.name}`);

      return {
        trends,
        executive_summary: executiveSummary,
        recommendations,
        discussion_points: discussionPoints
      };

    } catch (error) {
      logger.error('Narrative generation failed', { error: error.message, client: input.client.name });
      throw new OpenAIError('Failed to generate narrative', error.message);
    }
  }

  /**
   * Spot trends in the data (quarter-over-quarter analysis)
   */
  async spotTrends(input) {
    const prompt = `You are an Account Manager analyzing quarterly trends for ${input.client.name}.

STRICT RULES:
1. Only use facts from the PROVIDED DATA below. Never invent ticket IDs, device names, or metrics.
2. Every claim must cite evidence from the data.
3. Write in plain English for a non-technical executive audience.
4. Focus on business outcomes, not technical details.

PROVIDED DATA:
${JSON.stringify(input, null, 2)}

Analyze trends from the data:
1. Overall health trend (are the three scores improving or declining?)
2. Ticket volume trend (is it increasing or decreasing?)
3. Security posture trend (are risks increasing or being mitigated?)

Write a 2-paragraph trend analysis focusing on business impact.`;

    const response = await this.callOpenAI(prompt);
    return response;
  }

  /**
   * Write executive summary
   */
  async writeExecutiveSummary(input) {
    const prompt = `You are an Account Manager writing a quarterly business review for ${input.client.name}.

STRICT RULES:
1. Only use facts from the PROVIDED DATA below. Never invent ticket IDs, device names, or metrics.
2. Every claim must cite evidence: [Ticket #12345], [Device: WS-ACCT-01], [Policy: MFA Enforcement].
3. Write in plain English for a non-technical executive audience.
4. Focus on business outcomes (user productivity, risk reduction, cost avoidance), not technical details.

PROVIDED DATA:
${JSON.stringify(input, null, 2)}

Write a 3-paragraph executive summary:
1. Overall health this quarter (reference the three scores: Standards ${input.scores.standards.score}, Risk ${input.scores.risk.score}, Experience ${input.scores.experience.score})
2. Biggest win (with evidence from the data)
3. Top priority for next quarter (with business justification from the data)`;

    const response = await this.callOpenAI(prompt);
    return response;
  }

  /**
   * Synthesize action recommendations
   */
  async synthesizeActions(input) {
    const prompt = `You are an Account Manager creating actionable recommendations for ${input.client.name}.

STRICT RULES:
1. Only use facts from the PROVIDED DATA below. Never invent ticket IDs, device names, or metrics.
2. Every recommendation MUST have evidence array with citations: ["[Ticket #12345]", "[Device: WS-ACCT-01]"]
3. Write in plain English for a non-technical executive audience.
4. Focus on business outcomes.

PROVIDED DATA:
${JSON.stringify(input, null, 2)}

Generate 3-5 recommendations in this EXACT JSON format:
[
  {
    "title": "Short title",
    "description": "Plain English description focusing on business benefit",
    "priority": "high|medium|low",
    "effort": "low|medium|high",
    "cost_range": "$1-5K|$5-10K|$10K+",
    "evidence": ["[Ticket #123]", "[Device: DEVICE-NAME]"]
  }
]

Base recommendations ONLY on the actual data provided. Each recommendation must have at least one evidence citation.`;

    const response = await this.callOpenAI(prompt, true); // JSON mode
    return JSON.parse(response);
  }

  /**
   * Prepare discussion points for QBR meeting
   */
  async prepareDiscussionPoints(input) {
    const prompt = `You are an Account Manager preparing discussion topics for a quarterly business review with ${input.client.name}.

STRICT RULES:
1. Only use facts from the PROVIDED DATA below.
2. Write discussion topics, not full narratives.
3. Focus on business outcomes and strategic decisions.

PROVIDED DATA:
${JSON.stringify(input, null, 2)}

Generate 3-5 discussion topics as a JSON array of strings:
["Topic 1: Brief description", "Topic 2: Brief description", ...]

Each topic should invite strategic conversation, not just status updates.`;

    const response = await this.callOpenAI(prompt, true); // JSON mode
    return JSON.parse(response);
  }

  /**
   * Call OpenAI API with retry logic
   */
  async callOpenAI(prompt, jsonMode = false) {
    let lastError;

    for (let attempt = 1; attempt <= config.openai.maxRetries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert Account Manager for managed service providers. You focus on business outcomes and always cite evidence.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          ...(jsonMode && { response_format: { type: 'json_object' } })
        });

        return completion.choices[0].message.content;

      } catch (error) {
        lastError = error;
        logger.warn(`OpenAI API call failed (attempt ${attempt}/${config.openai.maxRetries})`, {
          error: error.message
        });

        if (attempt < config.openai.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new OpenAIError(`OpenAI API timeout after ${config.openai.maxRetries} retries`, lastError.message);
  }

  /**
   * Validate that all recommendations have proper citations
   */
  validateCitations(recommendations, input) {
    for (const rec of recommendations) {
      if (!rec.evidence || rec.evidence.length === 0) {
        throw new HallucinationDetectedError(
          `Recommendation "${rec.title}" has no evidence citations`
        );
      }

      // Extract cited entities and verify they exist in the data
      for (const citation of rec.evidence) {
        // Check for ticket citations
        const ticketMatch = citation.match(/\[Ticket #(\d+)\]/);
        if (ticketMatch) {
          const ticketId = ticketMatch[1];
          const ticketExists = input.recent_tickets?.some(t =>
            t.external_id === ticketId || t.id.toString() === ticketId
          );
          if (!ticketExists) {
            logger.warn(`Ticket #${ticketId} cited but not found in data`, { recommendation: rec.title });
          }
        }

        // Check for device citations
        const deviceMatch = citation.match(/\[Device: ([^\]]+)\]/);
        if (deviceMatch) {
          const deviceName = deviceMatch[1];
          const deviceExists = input.lifecycle_items?.some(d =>
            d.name === deviceName
          );
          if (!deviceExists) {
            logger.warn(`Device "${deviceName}" cited but not found in data`, { recommendation: rec.title });
          }
        }
      }
    }
  }
}

/**
 * Custom error classes
 */
class OpenAIError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'OpenAIError';
    this.details = details;
  }
}

class HallucinationDetectedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HallucinationDetectedError';
  }
}

module.exports = NarrativeGenerator;
