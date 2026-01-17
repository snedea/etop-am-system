const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Enhanced PDF Generator with comprehensive data tables
 */
class EnhancedPDFGenerator {
  async generateQBR(data) {
    logger.info(`Generating enhanced QBR PDF for client ${data.client.name}`);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 40, bottom: 40, left: 40, right: 40 }
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          logger.info(`Enhanced QBR PDF generated successfully`, { size: pdfData.length });
          resolve(pdfData);
        });
        doc.on('error', reject);

        // Render all sections with enhanced detail
        this.renderCoverPage(doc, data);
        this.renderTableOfContents(doc);
        this.renderExecutiveSummary(doc, data);
        this.renderClientInformation(doc, data);
        this.renderScoreDashboard(doc, data);
        this.renderDeviceInventory(doc, data);
        this.renderUserAccounts(doc, data);
        this.renderTicketAnalysis(doc, data);
        this.renderControlsCompliance(doc, data);
        this.renderSecurityPosture(doc, data);
        this.renderRisksDetailed(doc, data);
        this.renderLifecycleForecast(doc, data);
        this.renderRecommendations(doc, data);
        this.renderActionPlan(doc, data);

        doc.end();
      } catch (error) {
        logger.error('Enhanced PDF generation failed', { error: error.message });
        reject(error);
      }
    });
  }

  renderCoverPage(doc, data) {
    // Logo placeholder area
    doc.rect(220, 80, 150, 60).stroke();
    doc.fontSize(10).text('[Your Logo Here]', 220, 105, { width: 150, align: 'center' });

    doc.moveDown(4);
    doc.fontSize(32).font('Helvetica-Bold').text('Quarterly Business Review', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(24).text(data.client.name, { align: 'center' });

    doc.moveDown(3);
    const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
    doc.fontSize(16).font('Helvetica').text(quarter, { align: 'center' });

    doc.moveDown(1);
    doc.fontSize(12).text(new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }), { align: 'center' });

    // Agreement info at bottom
    if (data.agreements && data.agreements.length > 0) {
      doc.fontSize(10).text(
        `Service Agreement: $${data.agreements[0].mrr}/month | Term: ${data.agreements[0].term_months || 12} months`,
        40, 700, { align: 'center' }
      );
    }

    doc.addPage();
  }

  renderTableOfContents(doc) {
    this.renderSectionHeader(doc, 'Table of Contents');

    const sections = [
      '1. Executive Summary',
      '2. Client Information',
      '3. Health Score Dashboard',
      '4. Device Inventory',
      '5. User Accounts & Security',
      '6. Ticket Analysis',
      '7. Controls Compliance Matrix',
      '8. Security Posture Assessment',
      '9. Risk Register',
      '10. Lifecycle & Refresh Forecast',
      '11. Technology Roadmap',
      '12. Action Plan & Next Steps'
    ];

    doc.fontSize(11).font('Helvetica');
    sections.forEach(section => {
      doc.text(section);
      doc.moveDown(0.5);
    });

    doc.addPage();
  }

  renderExecutiveSummary(doc, data) {
    this.renderSectionHeader(doc, '1. Executive Summary');
    doc.fontSize(11).font('Helvetica').text(data.narrative.executive_summary, {
      align: 'justify',
      lineGap: 4
    });

    doc.addPage();
  }

  renderClientInformation(doc, data) {
    this.renderSectionHeader(doc, '2. Client Information');

    // Client details table
    const clientInfo = [
      ['Client Name:', data.client.name],
      ['Segment:', data.client.segment || 'Standard'],
      ['Agreement Start:', data.client.agreement_start ? new Date(data.client.agreement_start).toLocaleDateString() : 'N/A'],
      ['Agreement End:', data.client.agreement_end ? new Date(data.client.agreement_end).toLocaleDateString() : 'N/A'],
      ['Monthly Recurring Revenue:', data.client.mrr ? `$${data.client.mrr}` : 'N/A']
    ];

    this.renderKeyValueTable(doc, clientInfo);

    // Sites
    if (data.sites && data.sites.length > 0) {
      doc.moveDown(2);
      doc.fontSize(12).font('Helvetica-Bold').text('Locations');
      doc.moveDown(0.5);
      data.sites.forEach(site => {
        doc.fontSize(10).font('Helvetica').text(`• ${site.name}: ${site.address || 'Address not specified'}`);
      });
    }

    // Key Contacts
    if (data.contacts && data.contacts.length > 0) {
      doc.moveDown(2);
      doc.fontSize(12).font('Helvetica-Bold').text('Key Contacts');
      doc.moveDown(0.5);

      const contactHeaders = ['Name', 'Role', 'Email', 'Phone'];
      const contactRows = data.contacts.map(c => [
        c.name || 'N/A',
        c.role || 'N/A',
        c.email || 'N/A',
        c.phone || 'N/A'
      ]);

      this.renderTable(doc, contactHeaders, contactRows, [120, 80, 150, 90]);
    }

    doc.addPage();
  }

  renderScoreDashboard(doc, data) {
    this.renderSectionHeader(doc, '3. Health Score Dashboard');

    // Score summary
    const scores = [
      { name: 'Standards Compliance', score: data.scores.standards.score, color: '#2ECC71' },
      { name: 'Risk Level', score: data.scores.risk.score, color: '#E74C3C' },
      { name: 'Service Experience', score: data.scores.experience.score, color: '#3498DB' }
    ];

    let yPos = doc.y + 20;
    scores.forEach((scoreData, index) => {
      const xPos = 80 + (index * 160);
      this.renderScoreCircle(doc, xPos, yPos, scoreData.score, scoreData.name, scoreData.color);
    });

    doc.moveDown(10);

    // Standards breakdown
    doc.fontSize(12).font('Helvetica-Bold').text('Standards Compliance Breakdown');
    doc.moveDown(0.5);

    const standardsBreakdown = Object.entries(data.scores.standards.breakdown).map(([key, value]) => [
      this.formatKey(key),
      `${value.score}/100`,
      value.weight,
      value.evidence.description.substring(0, 80) + '...'
    ]);

    this.renderTable(doc, ['Component', 'Score', 'Weight', 'Status'], standardsBreakdown, [120, 50, 50, 200]);

    doc.addPage();
  }

  renderDeviceInventory(doc, data) {
    this.renderSectionHeader(doc, '4. Device Inventory');

    if (!data.devices || data.devices.length === 0) {
      doc.fontSize(11).text('No devices found.');
      doc.addPage();
      return;
    }

    doc.fontSize(11).text(`Total Devices: ${data.devices.length}`);
    doc.text(`Managed: ${data.devices.filter(d => d.managed).length}`);
    doc.text(`Healthy: ${data.devices.filter(d => d.health_status === 'healthy').length}`);
    doc.moveDown();

    // Device table
    const deviceHeaders = ['Device Name', 'Type', 'OS', 'Status', 'Health', 'Managed'];
    const deviceRows = data.devices.map(d => [
      d.name,
      d.type || 'Unknown',
      d.os || 'Unknown',
      'Active',
      d.health_status || 'Unknown',
      d.managed ? 'Yes' : 'No'
    ]);

    this.renderTable(doc, deviceHeaders, deviceRows, [100, 60, 100, 50, 60, 50]);

    doc.addPage();
  }

  renderUserAccounts(doc, data) {
    this.renderSectionHeader(doc, '5. User Accounts & Security');

    if (!data.users || data.users.length === 0) {
      doc.fontSize(11).text('No user accounts found.');
      doc.addPage();
      return;
    }

    const mfaEnabled = data.users.filter(u => u.mfa_enabled).length;
    const highRisk = data.users.filter(u => u.risk_level === 'high').length;

    doc.fontSize(11).text(`Total User Accounts: ${data.users.length}`);
    doc.text(`MFA Enabled: ${mfaEnabled} (${Math.round((mfaEnabled / data.users.length) * 100)}%)`);
    doc.text(`High Risk Users: ${highRisk}`);
    doc.moveDown();

    // User table
    const userHeaders = ['Email', 'UPN', 'MFA', 'Risk Level', 'Last Sign-In'];
    const userRows = data.users.map(u => [
      u.email,
      u.upn || u.email,
      u.mfa_enabled ? 'Yes' : 'No',
      u.risk_level || 'Low',
      u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString() : 'N/A'
    ]);

    this.renderTable(doc, userHeaders, userRows, [120, 120, 40, 60, 80]);

    doc.addPage();
  }

  renderTicketAnalysis(doc, data) {
    this.renderSectionHeader(doc, '6. Ticket Analysis');

    if (!data.tickets || data.tickets.length === 0) {
      doc.fontSize(11).text('No tickets found for this period.');
      doc.addPage();
      return;
    }

    const slaMetCount = data.tickets.filter(t => t.sla_met).length;
    const avgHours = (data.tickets.reduce((sum, t) => sum + (t.hours_spent || 0), 0) / data.tickets.length).toFixed(2);

    doc.fontSize(11).text(`Total Tickets: ${data.tickets.length}`);
    doc.text(`SLA Performance: ${Math.round((slaMetCount / data.tickets.length) * 100)}%`);
    doc.text(`Average Resolution Time: ${avgHours} hours`);
    doc.moveDown();

    // Ticket breakdown by category
    const categories = {};
    data.tickets.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + 1;
    });

    doc.fontSize(12).font('Helvetica-Bold').text('Tickets by Category');
    doc.moveDown(0.5);

    const categoryRows = Object.entries(categories).map(([cat, count]) => [
      cat,
      count.toString(),
      `${Math.round((count / data.tickets.length) * 100)}%`
    ]);

    this.renderTable(doc, ['Category', 'Count', 'Percentage'], categoryRows, [200, 100, 100]);

    doc.addPage();
  }

  renderControlsCompliance(doc, data) {
    this.renderSectionHeader(doc, '7. Controls Compliance Matrix');

    if (!data.controls || data.controls.length === 0) {
      doc.fontSize(11).text('No compliance controls configured.');
      doc.addPage();
      return;
    }

    const passing = data.controls.filter(c => c.status === 'pass').length;
    doc.fontSize(11).text(`Controls Passing: ${passing}/${data.controls.length} (${Math.round((passing / data.controls.length) * 100)}%)`);
    doc.moveDown();

    // Controls table
    const controlHeaders = ['Control Type', 'Status', 'Evidence', 'Last Checked'];
    const controlRows = data.controls.map(c => [
      c.control_type,
      c.status.toUpperCase(),
      c.evidence?.message || 'N/A',
      c.last_checked ? new Date(c.last_checked).toLocaleDateString() : 'N/A'
    ]);

    this.renderTable(doc, controlHeaders, controlRows, [120, 50, 180, 70]);

    doc.addPage();
  }

  renderSecurityPosture(doc, data) {
    this.renderSectionHeader(doc, '8. Security Posture Assessment');

    doc.fontSize(11).font('Helvetica').text(data.narrative.risk_narrative, {
      align: 'justify',
      lineGap: 4
    });

    doc.moveDown(2);

    // Security breakdown table
    const securityBreakdown = Object.entries(data.scores.risk.breakdown).map(([key, value]) => [
      this.formatKey(key),
      `${value.score}/100`,
      value.risk_level || 'N/A',
      value.evidence.description.substring(0, 60) + '...'
    ]);

    this.renderTable(doc, ['Security Domain', 'Score', 'Risk Level', 'Status'], securityBreakdown, [110, 50, 70, 200]);

    doc.addPage();
  }

  renderRisksDetailed(doc, data) {
    this.renderSectionHeader(doc, '9. Risk Register');

    if (!data.risks || data.risks.length === 0) {
      doc.fontSize(11).text('No active risks identified.');
      doc.addPage();
      return;
    }

    data.risks.forEach((risk, index) => {
      doc.fontSize(12).font('Helvetica-Bold').text(`Risk #${index + 1}: ${risk.title}`);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Impact: ${risk.impact} | Likelihood: ${risk.likelihood} | Status: ${risk.status}`);
      doc.text(`Description: ${risk.description}`);
      doc.moveDown(1.5);
    });

    doc.addPage();
  }

  renderLifecycleForecast(doc, data) {
    this.renderSectionHeader(doc, '10. Lifecycle & Refresh Forecast');

    if (!data.lifecycle || data.lifecycle.length === 0) {
      doc.fontSize(11).text('No devices flagged for lifecycle replacement.');
      doc.addPage();
      return;
    }

    doc.fontSize(11).text(`Devices flagged for refresh: ${data.lifecycle.length}`);
    doc.moveDown();

    // Lifecycle table
    const lifecycleHeaders = ['Device', 'OS', 'Type', 'Est. Replacement'];
    const lifecycleRows = data.lifecycle.map(d => [
      d.name,
      d.os,
      d.type,
      '6-12 months'
    ]);

    this.renderTable(doc, lifecycleHeaders, lifecycleRows, [120, 120, 80, 100]);

    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('Budget Forecast');
    doc.fontSize(10).font('Helvetica');
    const totalCost = data.lifecycle.length * 1200;
    doc.text(`12-month estimate: $${(totalCost * 0.33).toLocaleString()}`);
    doc.text(`24-month estimate: $${(totalCost * 0.67).toLocaleString()}`);
    doc.text(`36-month estimate: $${totalCost.toLocaleString()}`);

    doc.addPage();
  }

  renderRecommendations(doc, data) {
    this.renderSectionHeader(doc, '11. Technology Roadmap');

    if (!data.roadmap || data.roadmap.length === 0) {
      doc.fontSize(11).text('No recommendations available.');
      doc.addPage();
      return;
    }

    data.roadmap.forEach((rec, index) => {
      doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${rec.title}`);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Priority: ${rec.priority} | Quarter: ${rec.quarter} | Effort: ${rec.effort}`);
      doc.text(`Cost Range: ${rec.cost_range}`);
      doc.text(`Description: ${rec.description}`);
      doc.moveDown(1.5);
    });

    doc.addPage();
  }

  renderActionPlan(doc, data) {
    this.renderSectionHeader(doc, '12. Action Plan & Next Steps');

    if (!data.roadmap || data.roadmap.length === 0) {
      doc.fontSize(11).text('No action items defined.');
      return;
    }

    // Action plan table
    const actionHeaders = ['Action Item', 'Owner', 'Target', 'Status'];
    const actionRows = data.roadmap.slice(0, 10).map(item => [
      item.title,
      'IT Team',
      item.quarter,
      'Pending'
    ]);

    this.renderTable(doc, actionHeaders, actionRows, [200, 80, 60, 60]);

    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica-Oblique')
      .text('This QBR was generated by ETop AM Intelligence System', { align: 'center' });
  }

  // Helper: Render section header
  renderSectionHeader(doc, title) {
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#333333').text(title);
    doc.moveDown();
    doc.font('Helvetica').fillColor('#000000');
  }

  // Helper: Render a simple key-value table
  renderKeyValueTable(doc, rows) {
    const startY = doc.y;
    rows.forEach((row, index) => {
      const y = startY + (index * 20);
      doc.fontSize(10).font('Helvetica-Bold').text(row[0], 50, y);
      doc.fontSize(10).font('Helvetica').text(row[1], 200, y);
    });
    doc.moveDown(rows.length + 1);
  }

  // Helper: Render a data table
  renderTable(doc, headers, rows, columnWidths) {
    const startY = doc.y;
    const startX = 50;
    const rowHeight = 25;

    // Headers
    let xPos = startX;
    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, xPos, startY, { width: columnWidths[i], align: 'left' });
      xPos += columnWidths[i];
    });

    // Horizontal line under headers
    doc.moveTo(startX, startY + rowHeight - 5).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), startY + rowHeight - 5).stroke();

    // Data rows
    doc.font('Helvetica').fontSize(8);
    rows.forEach((row, rowIndex) => {
      const y = startY + rowHeight + (rowIndex * rowHeight);

      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
        return;
      }

      xPos = startX;
      row.forEach((cell, colIndex) => {
        doc.text(cell || '', xPos, y, { width: columnWidths[colIndex], align: 'left', height: rowHeight });
        xPos += columnWidths[colIndex];
      });
    });

    doc.moveDown(rows.length + 2);
  }

  // Helper: Render score circle
  renderScoreCircle(doc, x, y, score, label, color) {
    doc.save();

    // Circle
    doc.circle(x, y, 40).lineWidth(5).strokeColor(color).stroke();

    // Score
    doc.fontSize(20).font('Helvetica-Bold').fillColor(color).text(score.toString(), x - 30, y - 12, { width: 60, align: 'center' });

    // Label
    doc.fontSize(10).fillColor('#000000').text(label, x - 60, y + 50, { width: 120, align: 'center' });

    doc.restore();
  }

  // Helper: Format key
  formatKey(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
}

module.exports = EnhancedPDFGenerator;
