const ticketModel = require('../models/ticket');
const userModel = require('../models/user');
const { subMonths, startOfQuarter, endOfQuarter } = require('date-fns');
const logger = require('../utils/logger');

/**
 * Calculate Experience Score (0-100)
 * Weighted components:
 * - Tickets per user trend: 25%
 * - Repeat issue rate: 20%
 * - SLA performance: 25%
 * - Reopen rate: 15%
 * - After-hours incidents: 15%
 *
 * @param {number} clientId - Client ID
 * @returns {Promise<ScoreResult>}
 */
async function calculateExperienceScore(clientId) {
  try {
    logger.debug(`Calculating experience score for client ${clientId}`);

    // Calculate component scores
    const ticketsPerUserTrend = await calculateTicketsPerUserTrend(clientId);
    const repeatIssueRate = await calculateRepeatIssueRate(clientId);
    const slaPerformance = await calculateSLAPerformance(clientId);
    const reopenRate = await calculateReopenRate(clientId);
    const afterHoursIncidents = await calculateAfterHoursIncidents(clientId);

    // Calculate weighted total
    const components = [
      { ...ticketsPerUserTrend, weight: 0.25 },
      { ...repeatIssueRate, weight: 0.20 },
      { ...slaPerformance, weight: 0.25 },
      { ...reopenRate, weight: 0.15 },
      { ...afterHoursIncidents, weight: 0.15 }
    ];

    const totalScore = components.reduce((sum, component) => {
      return sum + (component.score * component.weight);
    }, 0);

    const breakdown = {
      tickets_per_user_trend: { ...ticketsPerUserTrend, weight: '25%' },
      repeat_issue_rate: { ...repeatIssueRate, weight: '20%' },
      sla_performance: { ...slaPerformance, weight: '25%' },
      reopen_rate: { ...reopenRate, weight: '15%' },
      after_hours_incidents: { ...afterHoursIncidents, weight: '15%' }
    };

    logger.info(`Experience score calculated for client ${clientId}: ${Math.round(totalScore)}`);

    return {
      score: Math.round(totalScore),
      breakdown,
      computed_at: new Date()
    };

  } catch (error) {
    logger.error(`Error calculating experience score for client ${clientId}`, { error: error.message });
    throw error;
  }
}

/**
 * Calculate tickets per user trend
 * Trending down = higher score
 */
async function calculateTicketsPerUserTrend(clientId) {
  const now = new Date();

  // Current quarter (Q4 2025 example)
  const currentQuarterStart = startOfQuarter(now);
  const currentQuarterEnd = endOfQuarter(now);

  // Previous quarter (Q3 2025)
  const previousQuarterStart = startOfQuarter(subMonths(now, 3));
  const previousQuarterEnd = endOfQuarter(subMonths(now, 3));

  // Get ticket counts
  const currentTickets = await ticketModel.findByDateRange(clientId, currentQuarterStart, currentQuarterEnd);
  const previousTickets = await ticketModel.findByDateRange(clientId, previousQuarterStart, previousQuarterEnd);

  // Get user count
  const userCount = await userModel.countByClientId(clientId);

  if (userCount === 0) {
    return {
      score: 50,
      evidence: {
        description: 'No user data available for tickets per user calculation'
      }
    };
  }

  const currentTicketsPerUser = currentTickets.length / userCount;
  const previousTicketsPerUser = previousTickets.length / userCount;

  // Calculate trend (percentage change)
  let trendPercentage = 0;
  if (previousTicketsPerUser > 0) {
    trendPercentage = ((currentTicketsPerUser - previousTicketsPerUser) / previousTicketsPerUser) * 100;
  }

  // Score: Decreasing tickets = higher score
  let score = 50; // Baseline
  if (trendPercentage < -20) score = 90; // Significant improvement
  else if (trendPercentage < -10) score = 75;
  else if (trendPercentage < 0) score = 60;
  else if (trendPercentage === 0) score = 50;
  else if (trendPercentage < 10) score = 40;
  else if (trendPercentage < 20) score = 30;
  else score = 20; // Significant decline

  return {
    score,
    evidence: {
      current_quarter_tickets: currentTickets.length,
      previous_quarter_tickets: previousTickets.length,
      user_count: userCount,
      current_tickets_per_user: currentTicketsPerUser.toFixed(1),
      previous_tickets_per_user: previousTicketsPerUser.toFixed(1),
      trend_percentage: Math.round(trendPercentage),
      description: `Current: ${currentTicketsPerUser.toFixed(1)} tickets/user, Previous: ${previousTicketsPerUser.toFixed(1)} tickets/user, Trend: ${trendPercentage > 0 ? '+' : ''}${Math.round(trendPercentage)}%`
    }
  };
}

/**
 * Calculate repeat issue rate
 * Same issue recurring = lower score
 */
async function calculateRepeatIssueRate(clientId) {
  const now = new Date();
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);

  const tickets = await ticketModel.findByDateRange(clientId, quarterStart, quarterEnd);

  if (tickets.length === 0) {
    return {
      score: 50,
      evidence: {
        description: 'No ticket data available for repeat issue calculation'
      }
    };
  }

  // Group tickets by category
  const categoryCount = {};
  tickets.forEach(ticket => {
    const category = ticket.category || 'Unknown';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  // Count categories with multiple tickets (repeats)
  const repeatCategories = Object.values(categoryCount).filter(count => count > 2).length;
  const totalCategories = Object.keys(categoryCount).length;

  const repeatRate = totalCategories > 0 ? (repeatCategories / totalCategories) * 100 : 0;

  // Score: Lower repeat rate = higher score
  const score = Math.max(0, 100 - repeatRate);

  return {
    score: Math.round(score),
    evidence: {
      total_tickets: tickets.length,
      total_categories: totalCategories,
      repeat_categories: repeatCategories,
      repeat_rate: Math.round(repeatRate),
      description: `${repeatCategories}/${totalCategories} categories (${Math.round(repeatRate)}%) have recurring issues`
    }
  };
}

/**
 * Calculate SLA performance
 * Percentage of tickets meeting SLA
 */
async function calculateSLAPerformance(clientId) {
  const now = new Date();
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);

  const totalTickets = (await ticketModel.findByDateRange(clientId, quarterStart, quarterEnd)).length;
  const slaMet = await ticketModel.countSLAMet(clientId, quarterStart, quarterEnd);

  if (totalTickets === 0) {
    return {
      score: 50,
      evidence: {
        description: 'No ticket data available for SLA performance calculation'
      }
    };
  }

  const slaPercentage = (slaMet / totalTickets) * 100;

  return {
    score: Math.round(slaPercentage),
    evidence: {
      total_tickets: totalTickets,
      sla_met: slaMet,
      sla_percentage: Math.round(slaPercentage),
      description: `${slaMet}/${totalTickets} tickets (${Math.round(slaPercentage)}%) met SLA`
    }
  };
}

/**
 * Calculate reopen rate
 * Percentage of tickets reopened
 */
async function calculateReopenRate(clientId) {
  const now = new Date();
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);

  const totalTickets = (await ticketModel.findByDateRange(clientId, quarterStart, quarterEnd)).length;
  const reopenedTickets = await ticketModel.countReopened(clientId, quarterStart, quarterEnd);

  if (totalTickets === 0) {
    return {
      score: 50,
      evidence: {
        description: 'No ticket data available for reopen rate calculation'
      }
    };
  }

  const reopenPercentage = (reopenedTickets / totalTickets) * 100;

  // Score: Lower reopen rate = higher score
  const score = Math.max(0, 100 - (reopenPercentage * 2)); // Double the penalty

  return {
    score: Math.round(score),
    evidence: {
      total_tickets: totalTickets,
      reopened_tickets: reopenedTickets,
      reopen_percentage: Math.round(reopenPercentage),
      description: `${reopenedTickets}/${totalTickets} tickets (${Math.round(reopenPercentage)}%) were reopened`
    }
  };
}

/**
 * Calculate after-hours incidents
 * Fewer = higher score
 */
async function calculateAfterHoursIncidents(clientId) {
  const now = new Date();
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);

  const tickets = await ticketModel.findByDateRange(clientId, quarterStart, quarterEnd);

  if (tickets.length === 0) {
    return {
      score: 50,
      evidence: {
        description: 'No ticket data available for after-hours calculation'
      }
    };
  }

  // Count tickets created outside business hours (simplified: weekends or before 8am/after 6pm)
  const afterHoursTickets = tickets.filter(ticket => {
    if (!ticket.created_date) return false;
    const date = new Date(ticket.created_date);
    const hour = date.getHours();
    const day = date.getDay();

    // Weekend or outside 8am-6pm
    return day === 0 || day === 6 || hour < 8 || hour >= 18;
  });

  const afterHoursPercentage = (afterHoursTickets.length / tickets.length) * 100;

  // Score: Fewer after-hours incidents = higher score
  const score = Math.max(0, 100 - (afterHoursPercentage * 1.5));

  return {
    score: Math.round(score),
    evidence: {
      total_tickets: tickets.length,
      after_hours_tickets: afterHoursTickets.length,
      after_hours_percentage: Math.round(afterHoursPercentage),
      description: `${afterHoursTickets.length}/${tickets.length} tickets (${Math.round(afterHoursPercentage)}%) created after hours`
    }
  };
}

module.exports = {
  calculateExperienceScore
};
