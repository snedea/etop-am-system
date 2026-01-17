const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const logger = require('../utils/logger');

/**
 * Ultimate PDF Generator with charts and visualizations
 */
class UltimatePDFGenerator {
  constructor() {
    this.chartRenderer = new ChartJSNodeCanvas({
      width: 500,
      height: 300,
      backgroundColour: 'white'
    });
  }

  async generateQBR(data) {
    logger.info(`Generating ultimate QBR PDF for client ${data.client.name}`);

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 40, bottom: 40, left: 40, right: 40 }
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          logger.info(`Ultimate QBR PDF generated successfully`, { size: pdfData.length });
          resolve(pdfData);
        });
        doc.on('error', reject);

        // Render all sections with charts
        await this.renderCoverPage(doc, data);
        this.renderTableOfContents(doc);
        this.renderExecutiveSummary(doc, data);
        await this.renderScoreDashboardWithCharts(doc, data);
        this.renderClientInformation(doc, data);
        await this.renderDeviceInventoryWithChart(doc, data);
        await this.renderUserAccountsWithChart(doc, data);
        await this.renderTicketAnalysisWithCharts(doc, data);
        this.renderControlsCompliance(doc, data);
        await this.renderSecurityPostureWithChart(doc, data);
        this.renderRisksDetailed(doc, data);
        this.renderLifecycleForecast(doc, data);
        this.renderRecommendations(doc, data);
        this.renderActionPlan(doc, data);

        doc.end();
      } catch (error) {
        logger.error('Ultimate PDF generation failed', { error: error.message });
        reject(error);
      }
    });
  }

  async renderCoverPage(doc, data) {
    // Draw a professional logo
    this.drawCompanyLogo(doc, 220, 60);

    doc.moveDown(6);
    doc.fontSize(36).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('Quarterly Business Review', { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(28).fillColor('#34495e').text(data.client.name, { align: 'center' });

    doc.moveDown(3);
    const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
    doc.fontSize(18).fillColor('#7f8c8d').text(quarter, { align: 'center' });

    doc.moveDown(1);
    doc.fontSize(12).text(new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }), { align: 'center' });

    // Decorative line
    doc.moveTo(100, 450).lineTo(495, 450).lineWidth(2).strokeColor('#3498db').stroke();

    // Agreement info at bottom
    if (data.agreements && data.agreements.length > 0) {
      doc.fontSize(11).fillColor('#34495e').text(
        `Managed Services Agreement: $${data.agreements[0].mrr}/month`,
        40, 680, { align: 'center' }
      );
      doc.fontSize(10).fillColor('#7f8c8d').text(
        `Term: ${data.agreements[0].term_months || 12} months | Effective Rate: $${data.agreements[0].effective_rate}/hour`,
        40, 700, { align: 'center' }
      );
    }

    // Footer
    doc.fontSize(9).fillColor('#95a5a6').text(
      'Confidential - For Client Review Only',
      40, 740, { align: 'center' }
    );

    doc.addPage();
  }

  drawCompanyLogo(doc, x, y) {
    // Draw a modern, professional tech logo
    doc.save();

    // Outer circle
    doc.circle(x + 75, y + 40, 35).lineWidth(3).strokeColor('#3498db').stroke();

    // Inner geometric pattern (tech/network style)
    doc.moveTo(x + 55, y + 30).lineTo(x + 95, y + 30).stroke();
    doc.moveTo(x + 55, y + 50).lineTo(x + 95, y + 50).stroke();
    doc.moveTo(x + 75, y + 20).lineTo(x + 75, y + 60).stroke();

    // Connection nodes
    doc.circle(x + 55, y + 30, 3).fillAndStroke('#3498db', '#3498db');
    doc.circle(x + 95, y + 30, 3).fillAndStroke('#3498db', '#3498db');
    doc.circle(x + 55, y + 50, 3).fillAndStroke('#3498db', '#3498db');
    doc.circle(x + 95, y + 50, 3).fillAndStroke('#3498db', '#3498db');
    doc.circle(x + 75, y + 40, 4).fillAndStroke('#e74c3c', '#e74c3c');

    // Company name
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('TechForward MSP', x, y + 85, { width: 150, align: 'center' });

    doc.restore();
  }

  renderTableOfContents(doc) {
    this.renderSectionHeader(doc, 'Table of Contents');

    const sections = [
      { num: '1', title: 'Executive Summary', page: '3' },
      { num: '2', title: 'Health Score Dashboard', page: '4' },
      { num: '3', title: 'Client Information', page: '5' },
      { num: '4', title: 'Device Inventory & Analytics', page: '6' },
      { num: '5', title: 'User Accounts & Security', page: '7' },
      { num: '6', title: 'Ticket Analysis & Trends', page: '8' },
      { num: '7', title: 'Controls Compliance Matrix', page: '9' },
      { num: '8', title: 'Security Posture Assessment', page: '10' },
      { num: '9', title: 'Risk Register', page: '11' },
      { num: '10', title: 'Lifecycle & Refresh Forecast', page: '12' },
      { num: '11', title: 'Technology Roadmap', page: '13' },
      { num: '12', title: 'Action Plan & Next Steps', page: '14' }
    ];

    doc.fontSize(11).font('Helvetica');
    sections.forEach(section => {
      doc.text(`${section.num}. ${section.title}`, 60);
      doc.text(section.page, 500, doc.y - 13, { align: 'right' });
      doc.moveDown(0.7);
    });

    doc.addPage();
  }

  renderExecutiveSummary(doc, data) {
    this.renderSectionHeader(doc, '1. Executive Summary');

    // Add a colored info box
    const boxY = doc.y;
    doc.rect(50, boxY, 495, 150).fillAndStroke('#ecf0f1', '#bdc3c7');

    doc.fontSize(11).fillColor('#2c3e50').font('Helvetica')
      .text(data.narrative.executive_summary, 65, boxY + 15, {
        width: 465,
        align: 'justify',
        lineGap: 5
      });

    doc.moveDown(10);

    // Key metrics at a glance
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c3e50').text('Key Metrics at a Glance');
    doc.moveDown();

    const metrics = [
      { label: 'Devices Under Management', value: `${data.devices.filter(d => d.managed).length}/${data.devices.length}`, color: '#27ae60' },
      { label: 'User Accounts', value: `${data.users.length}`, color: '#3498db' },
      { label: 'Tickets This Quarter', value: `${data.tickets.length}`, color: '#e67e22' },
      { label: 'Active Risks', value: `${data.risks.length}`, color: '#e74c3c' }
    ];

    let xPos = 60;
    metrics.forEach(metric => {
      doc.rect(xPos, doc.y, 115, 60).fillAndStroke(metric.color + '20', metric.color);
      doc.fontSize(24).font('Helvetica-Bold').fillColor(metric.color)
        .text(metric.value, xPos, doc.y + 10, { width: 115, align: 'center' });
      doc.fontSize(9).fillColor('#2c3e50')
        .text(metric.label, xPos, doc.y + 20, { width: 115, align: 'center' });
      xPos += 125;
    });

    doc.addPage();
  }

  async renderScoreDashboardWithCharts(doc, data) {
    this.renderSectionHeader(doc, '2. Health Score Dashboard');

    // Score gauges
    const scores = [
      { name: 'Standards', score: data.scores.standards.score, color: '#27ae60' },
      { name: 'Risk', score: data.scores.risk.score, color: '#e74c3c' },
      { name: 'Experience', score: data.scores.experience.score, color: '#3498db' }
    ];

    let xPos = 90;
    scores.forEach(scoreData => {
      this.renderGauge(doc, xPos, doc.y, scoreData.score, scoreData.name, scoreData.color);
      xPos += 160;
    });

    doc.moveDown(8);

    // Standards breakdown chart
    doc.fontSize(12).font('Helvetica-Bold').text('Standards Compliance Breakdown');
    doc.moveDown();

    const standardsChart = await this.generateBarChart(
      Object.keys(data.scores.standards.breakdown).map(k => this.formatKey(k)),
      Object.values(data.scores.standards.breakdown).map(v => v.score),
      'Standards Compliance by Component'
    );

    doc.image(standardsChart, 60, doc.y, { width: 480 });

    doc.addPage();
  }

  renderClientInformation(doc, data) {
    this.renderSectionHeader(doc, '3. Client Information');

    // Client details table with styling
    const clientInfo = [
      ['Client Name:', data.client.name],
      ['Segment:', data.client.segment || 'Standard'],
      ['Agreement Start:', data.client.agreement_start ? new Date(data.client.agreement_start).toLocaleDateString() : 'N/A'],
      ['Agreement End:', data.client.agreement_end ? new Date(data.client.agreement_end).toLocaleDateString() : 'N/A'],
      ['Monthly Recurring Revenue:', data.client.mrr ? `$${data.client.mrr.toLocaleString()}` : 'N/A']
    ];

    this.renderStyledKeyValueTable(doc, clientInfo);

    // Sites
    if (data.sites && data.sites.length > 0) {
      doc.moveDown(2);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50').text('Service Locations');
      doc.moveDown(0.5);
      data.sites.forEach(site => {
        doc.fontSize(10).font('Helvetica').fillColor('#34495e')
          .text(`📍 ${site.name}: ${site.address || 'Address not specified'}`);
      });
    }

    // Key Contacts
    if (data.contacts && data.contacts.length > 0) {
      doc.moveDown(2);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50').text('Key Contacts');
      doc.moveDown(0.5);

      const contactHeaders = ['Name', 'Role', 'Email', 'Phone'];
      const contactRows = data.contacts.map(c => [
        c.name || 'N/A',
        c.role || 'N/A',
        c.email || 'N/A',
        c.phone || 'N/A'
      ]);

      this.renderStyledTable(doc, contactHeaders, contactRows, [120, 80, 150, 90]);
    }

    doc.addPage();
  }

  async renderDeviceInventoryWithChart(doc, data) {
    this.renderSectionHeader(doc, '4. Device Inventory & Analytics');

    if (!data.devices || data.devices.length === 0) {
      doc.fontSize(11).text('No devices found.');
      doc.addPage();
      return;
    }

    // Summary stats
    const managed = data.devices.filter(d => d.managed).length;
    const healthy = data.devices.filter(d => d.health_status === 'healthy').length;

    doc.fontSize(11).fillColor('#2c3e50').text(`Total Devices: ${data.devices.length} | Managed: ${managed} | Healthy: ${healthy}`);
    doc.moveDown();

    // Device health pie chart
    const healthCounts = {
      'Healthy': data.devices.filter(d => d.health_status === 'healthy').length,
      'Warning': data.devices.filter(d => d.health_status === 'warning').length,
      'Critical': data.devices.filter(d => d.health_status === 'critical').length
    };

    const healthChart = await this.generatePieChart(
      Object.keys(healthCounts),
      Object.values(healthCounts),
      'Device Health Distribution',
      ['#27ae60', '#f39c12', '#e74c3c']
    );

    doc.image(healthChart, 60, doc.y, { width: 250 });

    // Device type breakdown (next to pie chart)
    const types = {};
    data.devices.forEach(d => {
      types[d.type || 'Unknown'] = (types[d.type || 'Unknown'] || 0) + 1;
    });

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('By Device Type', 350, doc.y - 180);
    doc.fontSize(10).font('Helvetica');
    let yOffset = doc.y - 160;
    Object.entries(types).forEach(([type, count]) => {
      doc.text(`${type}: ${count}`, 350, yOffset);
      yOffset += 15;
    });

    doc.moveDown(12);

    // Device table
    const deviceHeaders = ['Device Name', 'Type', 'OS', 'Health', 'Managed'];
    const deviceRows = data.devices.map(d => [
      d.name,
      d.type || 'Unknown',
      d.os || 'Unknown',
      d.health_status || 'Unknown',
      d.managed ? '✓' : '✗'
    ]);

    this.renderStyledTable(doc, deviceHeaders, deviceRows, [130, 70, 130, 70, 50]);

    doc.addPage();
  }

  async renderUserAccountsWithChart(doc, data) {
    this.renderSectionHeader(doc, '5. User Accounts & Security');

    if (!data.users || data.users.length === 0) {
      doc.fontSize(11).text('No user accounts found.');
      doc.addPage();
      return;
    }

    const mfaEnabled = data.users.filter(u => u.mfa_enabled).length;
    const mfaDisabled = data.users.length - mfaEnabled;

    // MFA coverage pie chart
    const mfaChart = await this.generateDoughnutChart(
      ['MFA Enabled', 'MFA Disabled'],
      [mfaEnabled, mfaDisabled],
      'Multi-Factor Authentication Coverage',
      ['#27ae60', '#e74c3c']
    );

    doc.image(mfaChart, 60, doc.y, { width: 250 });

    // Stats box
    doc.rect(340, doc.y - 170, 200, 150).fillAndStroke('#3498db20', '#3498db');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('Security Summary', 350, doc.y - 160);
    doc.fontSize(10).font('Helvetica')
      .text(`Total Users: ${data.users.length}`, 350, doc.y - 140)
      .text(`MFA Coverage: ${Math.round((mfaEnabled / data.users.length) * 100)}%`, 350, doc.y - 120)
      .text(`High Risk: ${data.users.filter(u => u.risk_level === 'high').length}`, 350, doc.y - 100)
      .text(`Medium Risk: ${data.users.filter(u => u.risk_level === 'medium').length}`, 350, doc.y - 80);

    doc.moveDown(12);

    // User table
    const userHeaders = ['Email', 'MFA', 'Risk Level', 'Last Sign-In'];
    const userRows = data.users.map(u => [
      u.email,
      u.mfa_enabled ? '✓ Yes' : '✗ No',
      u.risk_level || 'Low',
      u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString() : 'N/A'
    ]);

    this.renderStyledTable(doc, userHeaders, userRows, [180, 60, 80, 120]);

    doc.addPage();
  }

  async renderTicketAnalysisWithCharts(doc, data) {
    this.renderSectionHeader(doc, '6. Ticket Analysis & Trends');

    if (!data.tickets || data.tickets.length === 0) {
      doc.fontSize(11).text('No tickets found for this period.');
      doc.addPage();
      return;
    }

    const slaMetCount = data.tickets.filter(t => t.sla_met).length;
    const avgHours = (data.tickets.reduce((sum, t) => sum + (t.hours_spent || 0), 0) / data.tickets.length).toFixed(2);

    doc.fontSize(11).text(`Total Tickets: ${data.tickets.length} | SLA Performance: ${Math.round((slaMetCount / data.tickets.length) * 100)}% | Avg Resolution: ${avgHours}hrs`);
    doc.moveDown();

    // Category breakdown bar chart
    const categories = {};
    data.tickets.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + 1;
    });

    const categoryChart = await this.generateBarChart(
      Object.keys(categories),
      Object.values(categories),
      'Tickets by Category',
      '#3498db'
    );

    doc.image(categoryChart, 60, doc.y, { width: 480 });

    doc.moveDown(10);

    // Priority breakdown
    const priorities = {};
    data.tickets.forEach(t => {
      priorities[t.priority || 'medium'] = (priorities[t.priority || 'medium'] || 0) + 1;
    });

    doc.fontSize(12).font('Helvetica-Bold').text('By Priority Level');
    doc.moveDown(0.5);
    Object.entries(priorities).forEach(([priority, count]) => {
      doc.fontSize(10).font('Helvetica')
        .text(`${priority.charAt(0).toUpperCase() + priority.slice(1)}: ${count} tickets (${Math.round((count / data.tickets.length) * 100)}%)`);
    });

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
    const failing = data.controls.filter(c => c.status === 'fail').length;

    // Visual progress bar
    doc.fontSize(11).text(`Controls Compliance: ${passing}/${data.controls.length} Passing`);
    doc.moveDown(0.5);

    const barWidth = 400;
    const barHeight = 25;
    const passWidth = (passing / data.controls.length) * barWidth;

    doc.rect(60, doc.y, passWidth, barHeight).fillAndStroke('#27ae60', '#27ae60');
    doc.rect(60 + passWidth, doc.y - barHeight, barWidth - passWidth, barHeight).fillAndStroke('#e74c3c', '#e74c3c');

    doc.fontSize(10).fillColor('#ffffff')
      .text(`${Math.round((passing / data.controls.length) * 100)}%`, 60, doc.y - barHeight + 7, { width: barWidth, align: 'center' });

    doc.moveDown(2);
    doc.fillColor('#2c3e50');

    // Controls table
    const controlHeaders = ['Control Type', 'Status', 'Evidence', 'Last Checked'];
    const controlRows = data.controls.map(c => [
      c.control_type,
      c.status === 'pass' ? '✓ PASS' : '✗ FAIL',
      c.evidence?.message || 'N/A',
      c.last_checked ? new Date(c.last_checked).toLocaleDateString() : 'N/A'
    ]);

    this.renderStyledTable(doc, controlHeaders, controlRows, [130, 60, 180, 80]);

    doc.addPage();
  }

  async renderSecurityPostureWithChart(doc, data) {
    this.renderSectionHeader(doc, '8. Security Posture Assessment');

    // Security score breakdown radar chart
    const securityLabels = Object.keys(data.scores.risk.breakdown).map(k => this.formatKey(k));
    const securityScores = Object.values(data.scores.risk.breakdown).map(v => 100 - v.score); // Invert for radar (higher is better)

    const securityChart = await this.generateRadarChart(
      securityLabels,
      securityScores,
      'Security Domain Scores'
    );

    doc.image(securityChart, 60, doc.y, { width: 480 });

    doc.moveDown(10);

    // Security breakdown table
    const securityBreakdown = Object.entries(data.scores.risk.breakdown).map(([key, value]) => [
      this.formatKey(key),
      `${value.score}/100`,
      value.risk_level || 'N/A',
      value.evidence.description.substring(0, 60) + '...'
    ]);

    this.renderStyledTable(doc, ['Security Domain', 'Score', 'Risk Level', 'Status'], securityBreakdown, [110, 50, 70, 200]);

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
      // Risk card
      const cardColor = risk.impact === 'high' ? '#e74c3c' : risk.impact === 'medium' ? '#f39c12' : '#27ae60';

      doc.rect(50, doc.y, 495, 80).fillAndStroke(cardColor + '15', cardColor);

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#2c3e50')
        .text(`Risk #${index + 1}: ${risk.title}`, 65, doc.y + 15);

      doc.fontSize(9).font('Helvetica').fillColor(cardColor)
        .text(`Impact: ${risk.impact.toUpperCase()} | Likelihood: ${risk.likelihood.toUpperCase()} | Status: ${risk.status.toUpperCase()}`, 65, doc.y + 35);

      doc.fontSize(10).fillColor('#34495e')
        .text(risk.description, 65, doc.y + 50, { width: 465 });

      doc.moveDown(5);
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

    doc.fontSize(11).text(`Devices Requiring Refresh: ${data.lifecycle.length}`);
    doc.moveDown();

    // Budget timeline
    doc.fontSize(12).font('Helvetica-Bold').text('Refresh Budget Forecast');
    doc.moveDown(0.5);

    const totalCost = data.lifecycle.length * 1200;
    const budgets = [
      { period: '12 Months', amount: totalCost * 0.33, color: '#e74c3c' },
      { period: '24 Months', amount: totalCost * 0.67, color: '#f39c12' },
      { period: '36 Months', amount: totalCost, color: '#27ae60' }
    ];

    budgets.forEach(budget => {
      doc.rect(60, doc.y, 480, 35).fillAndStroke(budget.color + '20', budget.color);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(budget.color)
        .text(budget.period, 70, doc.y + 10);
      doc.fontSize(14).text(`$${budget.amount.toLocaleString()}`, 400, doc.y - 25, { width: 130, align: 'right' });
      doc.moveDown(2.5);
    });

    doc.moveDown();

    // Devices table
    const lifecycleHeaders = ['Device', 'OS', 'Type', 'Est. Cost'];
    const lifecycleRows = data.lifecycle.map(d => [
      d.name,
      d.os,
      d.type,
      '$1,200'
    ]);

    this.renderStyledTable(doc, lifecycleHeaders, lifecycleRows, [150, 150, 90, 80]);

    doc.addPage();
  }

  renderRecommendations(doc, data) {
    this.renderSectionHeader(doc, '11. Technology Roadmap');

    if (!data.roadmap || data.roadmap.length === 0) {
      doc.fontSize(11).text('No recommendations available.');
      doc.addPage();
      return;
    }

    // Roadmap timeline visualization
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    let xPos = 80;

    doc.fontSize(12).font('Helvetica-Bold').text('Quarterly Roadmap', 60, doc.y);
    doc.moveDown();

    quarters.forEach(q => {
      const qItems = data.roadmap.filter(r => r.quarter === q);

      doc.rect(xPos, doc.y, 100, 40).fillAndStroke('#3498db20', '#3498db');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#3498db')
        .text(q, xPos, doc.y + 5, { width: 100, align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#2c3e50')
        .text(`${qItems.length} items`, xPos, doc.y + 25, { width: 100, align: 'center' });

      xPos += 110;
    });

    doc.moveDown(4);

    // Recommendations detail
    data.roadmap.forEach((rec, index) => {
      const priorityColor = rec.priority === 'high' ? '#e74c3c' : rec.priority === 'medium' ? '#f39c12' : '#95a5a6';

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50')
        .text(`${index + 1}. ${rec.title}`);

      doc.fontSize(9).fillColor(priorityColor)
        .text(`Priority: ${rec.priority.toUpperCase()} | ${rec.quarter} | Effort: ${rec.effort} | Cost: ${rec.cost_range}`);

      doc.fontSize(10).font('Helvetica').fillColor('#34495e')
        .text(rec.description, { indent: 15 });

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
      '⏳ Pending'
    ]);

    this.renderStyledTable(doc, actionHeaders, actionRows, [220, 80, 60, 80]);

    doc.moveDown(3);

    // Sign-off section
    doc.rect(50, doc.y, 495, 100).fillAndStroke('#ecf0f1', '#bdc3c7');

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('Review & Approval', 65, doc.y + 15);

    doc.fontSize(10).font('Helvetica')
      .text('Client Signature: _________________________    Date: __________', 65, doc.y + 50)
      .text('MSP Representative: _______________________    Date: __________', 65, doc.y + 70);

    doc.moveDown(7);

    // Footer
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#95a5a6')
      .text('Generated by ETop AM Intelligence System | TechForward MSP', { align: 'center' });
    doc.fontSize(8).text('Confidential and Proprietary', { align: 'center' });
  }

  // Chart generation helpers
  async generateBarChart(labels, data, title, color = '#3498db') {
    const configuration = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: data,
          backgroundColor: color,
          borderColor: color,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false }
        },
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    };

    return await this.chartRenderer.renderToBuffer(configuration);
  }

  async generatePieChart(labels, data, title, colors = ['#3498db', '#e74c3c', '#f39c12', '#27ae60']) {
    const configuration = {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: title }
        }
      }
    };

    return await this.chartRenderer.renderToBuffer(configuration);
  }

  async generateDoughnutChart(labels, data, title, colors) {
    const configuration = {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: title }
        }
      }
    };

    return await this.chartRenderer.renderToBuffer(configuration);
  }

  async generateRadarChart(labels, data, title) {
    const configuration = {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: data,
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          borderColor: 'rgba(52, 152, 219, 1)',
          pointBackgroundColor: 'rgba(52, 152, 219, 1)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    };

    return await this.chartRenderer.renderToBuffer(configuration);
  }

  // Helper: Render section header
  renderSectionHeader(doc, title) {
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#2c3e50').text(title);
    doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).lineWidth(2).strokeColor('#3498db').stroke();
    doc.moveDown();
    doc.font('Helvetica').fillColor('#000000');
  }

  // Helper: Styled key-value table
  renderStyledKeyValueTable(doc, rows) {
    const startY = doc.y;
    rows.forEach((row, index) => {
      const y = startY + (index * 22);
      const bgColor = index % 2 === 0 ? '#ecf0f1' : '#ffffff';

      doc.rect(50, y, 495, 20).fillAndStroke(bgColor, '#bdc3c7');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2c3e50').text(row[0], 60, y + 5);
      doc.fontSize(10).font('Helvetica').fillColor('#34495e').text(row[1], 220, y + 5);
    });
    doc.moveDown(rows.length + 1);
  }

  // Helper: Styled data table
  renderStyledTable(doc, headers, rows, columnWidths) {
    const startY = doc.y;
    const startX = 50;
    const rowHeight = 22;

    // Header background
    const headerWidth = columnWidths.reduce((a, b) => a + b, 0);
    doc.rect(startX, startY, headerWidth, rowHeight).fillAndStroke('#34495e', '#2c3e50');

    // Headers
    let xPos = startX;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
    headers.forEach((header, i) => {
      doc.text(header, xPos + 5, startY + 5, { width: columnWidths[i] - 10, align: 'left' });
      xPos += columnWidths[i];
    });

    // Data rows
    doc.font('Helvetica').fontSize(9);
    rows.forEach((row, rowIndex) => {
      const y = startY + rowHeight + (rowIndex * rowHeight);

      if (y > 700) {
        doc.addPage();
        return;
      }

      // Alternating row colors
      const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#ecf0f1';
      doc.rect(startX, y, headerWidth, rowHeight).fillAndStroke(bgColor, '#bdc3c7');

      xPos = startX;
      doc.fillColor('#2c3e50');
      row.forEach((cell, colIndex) => {
        doc.text(cell || '', xPos + 5, y + 5, { width: columnWidths[colIndex] - 10, align: 'left', height: rowHeight });
        xPos += columnWidths[colIndex];
      });
    });

    doc.moveDown(rows.length + 2);
  }

  // Helper: Render gauge
  renderGauge(doc, x, y, score, label, color) {
    doc.save();

    // Outer ring
    doc.circle(x, y, 45).lineWidth(8).strokeColor('#ecf0f1').stroke();

    // Score arc
    const angle = (score / 100) * 360;
    const endAngle = angle - 90;

    doc.circle(x, y, 45).lineWidth(8).strokeColor(color).stroke();

    // Score text
    doc.fontSize(24).font('Helvetica-Bold').fillColor(color)
      .text(score.toString(), x - 30, y - 12, { width: 60, align: 'center' });

    // Label
    doc.fontSize(11).fillColor('#2c3e50').font('Helvetica')
      .text(label, x - 70, y + 55, { width: 140, align: 'center' });

    doc.restore();
  }

  // Helper: Format key
  formatKey(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
}

module.exports = UltimatePDFGenerator;
