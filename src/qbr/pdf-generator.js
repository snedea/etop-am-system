const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * PDF Generator
 * Generates 9-section QBR PDF using PDFKit
 */

class PDFGenerator {
  /**
   * Generate QBR PDF
   * @param {Object} data - Complete QBR data
   * @returns {Promise<Buffer>}
   */
  async generateQBR(data) {
    logger.info(`Generating QBR PDF for client ${data.client.name}`);

    return new Promise((resolve, reject) => {
      try {
        // Create PDF document
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Collect PDF data in buffer
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          logger.info(`QBR PDF generated successfully for client ${data.client.name}`, {
            size: pdfData.length
          });
          resolve(pdfData);
        });
        doc.on('error', reject);

        // Render all 9 sections
        this.renderCoverPage(doc, data);
        this.renderExecutiveSummary(doc, data);
        this.renderScoreDashboard(doc, data);
        this.renderTopRisks(doc, data);
        this.renderTopWins(doc, data);
        this.renderServiceStory(doc, data);
        this.renderSecurityStory(doc, data);
        this.renderLifecycleForecast(doc, data);
        this.renderRoadmap(doc, data);
        this.renderOutcomePlan(doc, data);

        // Finalize PDF
        doc.end();

      } catch (error) {
        logger.error('PDF generation failed', { error: error.message, client: data.client.name });
        reject(new PDFGenerationError(error.message));
      }
    });
  }

  /**
   * Render cover page
   */
  renderCoverPage(doc, data) {
    doc.fontSize(28).text('Quarterly Business Review', { align: 'center' });
    doc.moveDown();
    doc.fontSize(20).text(data.client.name, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }), { align: 'center' });

    doc.addPage();
  }

  /**
   * Section 1: Executive Summary
   */
  renderExecutiveSummary(doc, data) {
    this.renderSectionHeader(doc, '1. Executive Summary');

    doc.fontSize(11).text(data.narrative.executive_summary, {
      align: 'justify',
      lineGap: 4
    });

    doc.addPage();
  }

  /**
   * Section 2: Score Dashboard
   */
  renderScoreDashboard(doc, data) {
    this.renderSectionHeader(doc, '2. Health Score Dashboard');

    const scores = [
      { name: 'Standards Compliance', score: data.scores.standards.score, color: '#2ECC71' },
      { name: 'Risk Level', score: data.scores.risk.score, color: '#E74C3C' },
      { name: 'Experience', score: data.scores.experience.score, color: '#3498DB' }
    ];

    let yPosition = doc.y + 20;

    scores.forEach((scoreData, index) => {
      const xPosition = 100 + (index * 150);
      this.renderGauge(doc, xPosition, yPosition, scoreData.score, scoreData.name, scoreData.color);
    });

    doc.moveDown(8);
    doc.fontSize(11).text(data.narrative.trends, { align: 'justify', lineGap: 4 });

    doc.addPage();
  }

  /**
   * Section 3: Top 5 Risks
   */
  renderTopRisks(doc, data) {
    this.renderSectionHeader(doc, '3. Top 5 Risks');

    if (!data.risks || data.risks.length === 0) {
      doc.fontSize(11).text('No open risks identified.');
      doc.addPage();
      return;
    }

    const topRisks = data.risks.slice(0, 5);

    topRisks.forEach((risk, index) => {
      doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${risk.title}`);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Impact: ${risk.impact} | Likelihood: ${risk.likelihood}`, { indent: 20 });
      doc.text(`Description: ${risk.description}`, { indent: 20 });
      doc.moveDown();
    });

    doc.addPage();
  }

  /**
   * Section 4: Top 5 Wins
   */
  renderTopWins(doc, data) {
    this.renderSectionHeader(doc, '4. Top 5 Wins This Quarter');

    if (!data.wins || data.wins.length === 0) {
      doc.fontSize(11).text('No significant wins identified this quarter.');
      doc.addPage();
      return;
    }

    data.wins.slice(0, 5).forEach((win, index) => {
      doc.fontSize(11).text(`${index + 1}. ${win}`, { bulletRadius: 3 });
      doc.moveDown(0.5);
    });

    doc.addPage();
  }

  /**
   * Section 5: Service Experience Story
   */
  renderServiceStory(doc, data) {
    this.renderSectionHeader(doc, '5. Service Experience Story');

    const exp = data.scores.experience.breakdown;

    doc.fontSize(12).font('Helvetica-Bold').text('Ticket Performance');
    doc.fontSize(10).font('Helvetica');
    doc.text(`• ${exp.tickets_per_user_trend.evidence.description}`);
    doc.text(`• SLA Performance: ${exp.sla_performance.evidence.description}`);
    doc.text(`• Reopen Rate: ${exp.reopen_rate.evidence.description}`);

    doc.addPage();
  }

  /**
   * Section 6: Security Posture Story
   */
  renderSecurityStory(doc, data) {
    this.renderSectionHeader(doc, '6. Security Posture Story');

    const risk = data.scores.risk.breakdown;

    doc.fontSize(12).font('Helvetica-Bold').text('Identity Security');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Risk Level: ${risk.identity_risk.risk_level}`);
    doc.text(risk.identity_risk.evidence.description);
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Email Security');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Risk Level: ${risk.email_risk.risk_level}`);
    doc.text(risk.email_risk.evidence.description);
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Endpoint Security');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Risk Level: ${risk.endpoint_risk.risk_level}`);
    doc.text(risk.endpoint_risk.evidence.description);

    doc.addPage();
  }

  /**
   * Section 7: Lifecycle Forecast
   */
  renderLifecycleForecast(doc, data) {
    this.renderSectionHeader(doc, '7. Lifecycle Forecast');

    if (!data.lifecycle || data.lifecycle.length === 0) {
      doc.fontSize(11).text('No devices flagged for lifecycle replacement.');
      doc.addPage();
      return;
    }

    doc.fontSize(11).text(`${data.lifecycle.length} devices due for refresh:`);
    doc.moveDown();

    data.lifecycle.slice(0, 10).forEach(device => {
      doc.fontSize(10).text(`• ${device.name} (${device.os || 'Unknown OS'})`);
    });

    // Budget estimates (simplified)
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('Estimated Refresh Budget');
    doc.fontSize(10).font('Helvetica');
    const estimatedCost = data.lifecycle.length * 1200; // $1200 per device average
    doc.text(`12-month: $${(estimatedCost * 0.33).toLocaleString()}`);
    doc.text(`24-month: $${(estimatedCost * 0.67).toLocaleString()}`);
    doc.text(`36-month: $${estimatedCost.toLocaleString()}`);

    doc.addPage();
  }

  /**
   * Section 8: Roadmap
   */
  renderRoadmap(doc, data) {
    this.renderSectionHeader(doc, '8. Technology Roadmap');

    if (!data.roadmap || data.roadmap.length === 0) {
      doc.fontSize(11).text('No recommendations available for this quarter.');
      doc.addPage();
      return;
    }

    const now = data.roadmap.filter(r => r.priority === 'high');
    const next = data.roadmap.filter(r => r.priority === 'medium');
    const later = data.roadmap.filter(r => r.priority === 'low');

    doc.fontSize(12).font('Helvetica-Bold').text('Now (High Priority)');
    doc.fontSize(10).font('Helvetica');
    now.forEach(item => doc.text(`• ${item.title}`, { indent: 10 }));
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Next (Medium Priority)');
    doc.fontSize(10).font('Helvetica');
    next.forEach(item => doc.text(`• ${item.title}`, { indent: 10 }));
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Later (Low Priority)');
    doc.fontSize(10).font('Helvetica');
    later.forEach(item => doc.text(`• ${item.title}`, { indent: 10 }));

    doc.addPage();
  }

  /**
   * Section 9: Outcome Plan
   */
  renderOutcomePlan(doc, data) {
    this.renderSectionHeader(doc, '9. Action Plan & Next Steps');

    if (!data.roadmap || data.roadmap.length === 0) {
      doc.fontSize(11).text('No action items defined.');
      return;
    }

    data.roadmap.slice(0, 5).forEach((item, index) => {
      doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${item.title}`);
      doc.fontSize(10).font('Helvetica');
      doc.text(item.description, { indent: 20 });
      doc.text(`Effort: ${item.effort} | Cost: ${item.cost_range}`, { indent: 20 });
      doc.moveDown();
    });
  }

  /**
   * Helper: Render section header
   */
  renderSectionHeader(doc, title) {
    doc.fontSize(18).font('Helvetica-Bold').text(title);
    doc.moveDown();
    doc.font('Helvetica');
  }

  /**
   * Helper: Render gauge chart (simplified as text for now)
   */
  renderGauge(doc, x, y, score, label, color) {
    doc.save();
    doc.fontSize(24).fillColor(color).text(score, x, y, { width: 100, align: 'center' });
    doc.fontSize(10).fillColor('#000000').text(label, x, y + 30, { width: 100, align: 'center' });
    doc.restore();
  }
}

/**
 * Custom error class
 */
class PDFGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PDFGenerationError';
  }
}

module.exports = PDFGenerator;
