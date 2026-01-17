const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const logger = require('../utils/logger');

/**
 * Production-ready PDF Generator with proper layout management
 */
class ProductionPDFGenerator {
  constructor() {
    this.chartRenderer = new ChartJSNodeCanvas({
      width: 400,
      height: 200,
      backgroundColour: 'white'
    });

    this.pageWidth = 595.28; // Letter width in points
    this.pageHeight = 841.89; // Letter height in points
    this.margin = 50;
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  async generateQBR(data) {
    logger.info(`Generating production QBR PDF for client ${data.client.name}`);

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: {
            top: this.margin,
            bottom: this.margin,
            left: this.margin,
            right: this.margin
          }
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          logger.info(`Production QBR PDF generated successfully`, { size: pdfData.length });
          resolve(pdfData);
        });
        doc.on('error', reject);

        // Generate all sections with proper spacing
        await this.renderCoverPage(doc, data);
        this.renderTableOfContents(doc, data);
        this.renderExecutiveSummary(doc, data);
        await this.renderScoreDashboard(doc, data);
        this.renderClientInfo(doc, data);
        await this.renderDeviceInventory(doc, data);
        await this.renderUserAccounts(doc, data);
        await this.renderTicketAnalysis(doc, data);
        this.renderControlsCompliance(doc, data);
        await this.renderSecurityPosture(doc, data);
        this.renderRisks(doc, data);
        this.renderLifecycle(doc, data);
        this.renderRoadmap(doc, data);
        this.renderActionPlan(doc, data);

        doc.end();
      } catch (error) {
        logger.error('Production PDF generation failed', { error: error.message });
        reject(error);
      }
    });
  }

  checkSpace(doc, requiredSpace) {
    if (doc.y + requiredSpace > this.pageHeight - this.margin) {
      doc.addPage();
      return true;
    }
    return false;
  }

  async renderCoverPage(doc, data) {
    // Logo
    this.drawLogo(doc, 220, 100);

    doc.moveDown(4);
    doc.fontSize(32).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('Quarterly Business Review', { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(24).text(data.client.name, { align: 'center' });

    doc.moveDown(2);
    const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
    doc.fontSize(16).fillColor('#7f8c8d').text(quarter, { align: 'center' });

    doc.fontSize(12).text(new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    }), { align: 'center' });

    // Agreement info
    if (data.agreements && data.agreements.length > 0) {
      doc.fontSize(10).fillColor('#34495e')
        .text(`MRR: $${data.agreements[0].mrr}/month | Term: ${data.agreements[0].term_months || 12} months`,
          this.margin, 700, { width: this.contentWidth, align: 'center' });
    }

    doc.fontSize(9).fillColor('#95a5a6')
      .text('Confidential - For Client Review Only', this.margin, 750,
        { width: this.contentWidth, align: 'center' });

    doc.addPage();
  }

  drawLogo(doc, x, y) {
    doc.save();
    doc.circle(x + 75, y + 40, 30).lineWidth(3).strokeColor('#3498db').stroke();
    doc.moveTo(x + 60, y + 30).lineTo(x + 90, y + 30).stroke();
    doc.moveTo(x + 60, y + 50).lineTo(x + 90, y + 50).stroke();
    doc.circle(x + 75, y + 40, 3).fillAndStroke('#e74c3c', '#e74c3c');
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('TechForward MSP', x + 20, y + 80, { width: 110, align: 'center' });
    doc.restore();
  }

  renderTableOfContents(doc, data) {
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#2c3e50').text('Table of Contents');
    doc.moveDown(2);

    const sections = [
      '1. Executive Summary',
      '2. Health Score Dashboard',
      '3. Client Information',
      '4. Device Inventory',
      '5. User Accounts & Security',
      '6. Ticket Analysis',
      '7. Controls Compliance',
      '8. Security Posture',
      '9. Risk Register',
      '10. Lifecycle Forecast',
      '11. Technology Roadmap',
      '12. Action Plan'
    ];

    doc.fontSize(11).font('Helvetica').fillColor('#34495e');
    sections.forEach(section => {
      doc.text(section);
      doc.moveDown(0.5);
    });

    doc.addPage();
  }

  renderExecutiveSummary(doc, data) {
    this.renderSectionHeader(doc, '1. Executive Summary');

    doc.fontSize(11).font('Helvetica').fillColor('#2c3e50')
      .text(data.narrative.executive_summary, {
        align: 'justify',
        lineGap: 5
      });

    doc.moveDown(2);

    // Key metrics in boxes
    doc.fontSize(12).font('Helvetica-Bold').text('Key Metrics');
    doc.moveDown(1);

    const metrics = [
      { label: 'Devices', value: data.devices.length },
      { label: 'Users', value: data.users.length },
      { label: 'Tickets', value: data.tickets.length },
      { label: 'Risks', value: data.risks.length }
    ];

    let xPos = this.margin;
    metrics.forEach(metric => {
      doc.rect(xPos, doc.y, 110, 50).stroke('#bdc3c7');
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#3498db')
        .text(metric.value.toString(), xPos, doc.y + 10, { width: 110, align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#2c3e50')
        .text(metric.label, xPos, doc.y + 30, { width: 110, align: 'center' });
      xPos += 120;
    });

    doc.addPage();
  }

  async renderScoreDashboard(doc, data) {
    this.renderSectionHeader(doc, '2. Health Score Dashboard');

    // Score circles
    const scores = [
      { name: 'Standards', score: data.scores.standards.score, color: '#27ae60' },
      { name: 'Risk', score: data.scores.risk.score, color: '#e74c3c' },
      { name: 'Experience', score: data.scores.experience.score, color: '#3498db' }
    ];

    const startY = doc.y + 20;
    scores.forEach((s, i) => {
      const x = this.margin + 80 + (i * 150);
      this.drawGauge(doc, x, startY, s.score, s.name, s.color);
    });

    doc.y = startY + 100;
    doc.moveDown(2);

    this.checkSpace(doc, 250);

    // Chart
    doc.fontSize(12).font('Helvetica-Bold').text('Standards Breakdown');
    doc.moveDown(0.5);

    const labels = Object.keys(data.scores.standards.breakdown).map(k =>
      k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    );
    const values = Object.values(data.scores.standards.breakdown).map(v => v.score);

    const chart = await this.generateBarChart(labels, values);
    doc.image(chart, this.margin, doc.y, { width: this.contentWidth });

    doc.addPage();
  }

  renderClientInfo(doc, data) {
    this.renderSectionHeader(doc, '3. Client Information');

    const info = [
      ['Client:', data.client.name],
      ['Segment:', data.client.segment || 'Standard'],
      ['MRR:', data.client.mrr ? `$${data.client.mrr}` : 'N/A']
    ];

    info.forEach(row => {
      doc.fontSize(10).font('Helvetica-Bold').text(row[0], this.margin, doc.y, { continued: true });
      doc.font('Helvetica').text(' ' + row[1]);
      doc.moveDown(0.3);
    });

    doc.moveDown(2);

    if (data.sites && data.sites.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Locations');
      doc.moveDown(0.5);
      data.sites.forEach(site => {
        doc.fontSize(10).font('Helvetica').text(`• ${site.name}`);
        if (site.address) doc.text(`  ${site.address}`, { indent: 15 });
        doc.moveDown(0.3);
      });
    }

    doc.moveDown(2);

    if (data.contacts && data.contacts.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Key Contacts');
      doc.moveDown(0.5);

      data.contacts.forEach(contact => {
        doc.fontSize(10).font('Helvetica')
          .text(`${contact.role || 'Contact'}: ${contact.email || 'N/A'}`);
        doc.moveDown(0.3);
      });
    }

    doc.addPage();
  }

  async renderDeviceInventory(doc, data) {
    this.renderSectionHeader(doc, '4. Device Inventory');

    if (!data.devices || data.devices.length === 0) {
      doc.text('No devices found.');
      doc.addPage();
      return;
    }

    const managed = data.devices.filter(d => d.managed).length;
    const healthy = data.devices.filter(d => d.health_status === 'healthy').length;

    doc.fontSize(10).text(`Total: ${data.devices.length} | Managed: ${managed} | Healthy: ${healthy}`);
    doc.moveDown(1);

    this.checkSpace(doc, 250);

    // Chart
    const healthData = [
      data.devices.filter(d => d.health_status === 'healthy').length,
      data.devices.filter(d => d.health_status === 'warning').length,
      data.devices.filter(d => d.health_status === 'critical').length
    ];

    const healthChart = await this.generatePieChart(
      ['Healthy', 'Warning', 'Critical'],
      healthData,
      ['#27ae60', '#f39c12', '#e74c3c']
    );

    doc.image(healthChart, this.margin, doc.y, { width: 300 });
    doc.y += 220;

    doc.moveDown(1);

    // Device list
    doc.fontSize(11).font('Helvetica-Bold').text('Devices');
    doc.moveDown(0.5);

    data.devices.forEach(device => {
      this.checkSpace(doc, 30);
      doc.fontSize(9).font('Helvetica')
        .text(`${device.name} - ${device.type || 'Unknown'} - ${device.os || 'Unknown'} - ${device.health_status || 'Unknown'}`);
      doc.moveDown(0.2);
    });

    doc.addPage();
  }

  async renderUserAccounts(doc, data) {
    this.renderSectionHeader(doc, '5. User Accounts & Security');

    if (!data.users || data.users.length === 0) {
      doc.text('No users found.');
      doc.addPage();
      return;
    }

    const mfaEnabled = data.users.filter(u => u.mfa_enabled).length;

    doc.fontSize(10).text(`Total Users: ${data.users.length} | MFA Enabled: ${mfaEnabled} (${Math.round((mfaEnabled/data.users.length)*100)}%)`);
    doc.moveDown(1);

    this.checkSpace(doc, 250);

    // MFA chart
    const mfaChart = await this.generatePieChart(
      ['MFA Enabled', 'MFA Disabled'],
      [mfaEnabled, data.users.length - mfaEnabled],
      ['#27ae60', '#e74c3c']
    );

    doc.image(mfaChart, this.margin, doc.y, { width: 300 });
    doc.y += 220;

    doc.moveDown(1);

    // User list
    doc.fontSize(11).font('Helvetica-Bold').text('User Accounts');
    doc.moveDown(0.5);

    data.users.forEach(user => {
      this.checkSpace(doc, 25);
      doc.fontSize(9).font('Helvetica')
        .text(`${user.email} - MFA: ${user.mfa_enabled ? 'Yes' : 'No'} - Risk: ${user.risk_level || 'Low'}`);
      doc.moveDown(0.2);
    });

    doc.addPage();
  }

  async renderTicketAnalysis(doc, data) {
    this.renderSectionHeader(doc, '6. Ticket Analysis');

    if (!data.tickets || data.tickets.length === 0) {
      doc.text('No tickets found.');
      doc.addPage();
      return;
    }

    const slaMetCount = data.tickets.filter(t => t.sla_met).length;
    doc.fontSize(10).text(`Total: ${data.tickets.length} | SLA Met: ${Math.round((slaMetCount/data.tickets.length)*100)}%`);
    doc.moveDown(1);

    this.checkSpace(doc, 250);

    // Category breakdown
    const categories = {};
    data.tickets.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + 1;
    });

    const categoryChart = await this.generateBarChart(
      Object.keys(categories),
      Object.values(categories)
    );

    doc.image(categoryChart, this.margin, doc.y, { width: this.contentWidth });
    doc.y += 220;

    doc.addPage();
  }

  renderControlsCompliance(doc, data) {
    this.renderSectionHeader(doc, '7. Controls Compliance');

    if (!data.controls || data.controls.length === 0) {
      doc.text('No controls found.');
      doc.addPage();
      return;
    }

    const passing = data.controls.filter(c => c.status === 'pass').length;
    doc.fontSize(10).text(`Passing: ${passing}/${data.controls.length} (${Math.round((passing/data.controls.length)*100)}%)`);
    doc.moveDown(1);

    data.controls.forEach(control => {
      this.checkSpace(doc, 30);
      const status = control.status === 'pass' ? '✓ PASS' : '✗ FAIL';
      doc.fontSize(9).font('Helvetica')
        .text(`${control.control_type}: ${status} - ${control.evidence?.message || 'N/A'}`);
      doc.moveDown(0.3);
    });

    doc.addPage();
  }

  async renderSecurityPosture(doc, data) {
    this.renderSectionHeader(doc, '8. Security Posture');

    doc.fontSize(10).text(data.narrative.risk_narrative.substring(0, 500), {
      align: 'justify',
      lineGap: 4
    });

    doc.moveDown(2);

    const securityScores = Object.values(data.scores.risk.breakdown).map(v => 100 - v.score);
    const securityLabels = Object.keys(data.scores.risk.breakdown).map(k =>
      k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    );

    this.checkSpace(doc, 250);

    const radarChart = await this.generateRadarChart(securityLabels, securityScores);
    doc.image(radarChart, this.margin, doc.y, { width: this.contentWidth });

    doc.addPage();
  }

  renderRisks(doc, data) {
    this.renderSectionHeader(doc, '9. Risk Register');

    if (!data.risks || data.risks.length === 0) {
      doc.text('No active risks.');
      doc.addPage();
      return;
    }

    data.risks.forEach((risk, index) => {
      this.checkSpace(doc, 60);

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50')
        .text(`Risk ${index + 1}: ${risk.title}`);

      doc.fontSize(9).font('Helvetica').fillColor('#7f8c8d')
        .text(`Impact: ${risk.impact} | Likelihood: ${risk.likelihood}`);

      doc.fontSize(9).fillColor('#34495e')
        .text(risk.description, { lineGap: 3 });

      doc.moveDown(1);
    });

    doc.addPage();
  }

  renderLifecycle(doc, data) {
    this.renderSectionHeader(doc, '10. Lifecycle & Refresh Forecast');

    if (!data.lifecycle || data.lifecycle.length === 0) {
      doc.text('No devices flagged for replacement.');
      doc.addPage();
      return;
    }

    doc.fontSize(10).text(`Devices requiring refresh: ${data.lifecycle.length}`);
    doc.moveDown(1);

    const totalCost = data.lifecycle.length * 1200;

    doc.fontSize(11).font('Helvetica-Bold').text('Budget Forecast');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica')
      .text(`12-month: $${(totalCost * 0.33).toLocaleString()}`)
      .text(`24-month: $${(totalCost * 0.67).toLocaleString()}`)
      .text(`36-month: $${totalCost.toLocaleString()}`);

    doc.moveDown(2);

    doc.fontSize(11).font('Helvetica-Bold').text('Devices');
    doc.moveDown(0.5);

    data.lifecycle.forEach(device => {
      this.checkSpace(doc, 20);
      doc.fontSize(9).font('Helvetica').text(`${device.name} - ${device.os} - ${device.type}`);
      doc.moveDown(0.2);
    });

    doc.addPage();
  }

  renderRoadmap(doc, data) {
    this.renderSectionHeader(doc, '11. Technology Roadmap');

    if (!data.roadmap || data.roadmap.length === 0) {
      doc.text('No recommendations.');
      doc.addPage();
      return;
    }

    data.roadmap.forEach((rec, index) => {
      this.checkSpace(doc, 50);

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50')
        .text(`${index + 1}. ${rec.title}`);

      doc.fontSize(9).font('Helvetica').fillColor('#7f8c8d')
        .text(`Priority: ${rec.priority} | ${rec.quarter} | ${rec.cost_range}`);

      doc.fontSize(9).fillColor('#34495e')
        .text(rec.description, { lineGap: 3 });

      doc.moveDown(1);
    });

    doc.addPage();
  }

  renderActionPlan(doc, data) {
    this.renderSectionHeader(doc, '12. Action Plan & Next Steps');

    if (!data.roadmap || data.roadmap.length === 0) {
      doc.text('No action items.');
      return;
    }

    data.roadmap.slice(0, 10).forEach((item, index) => {
      this.checkSpace(doc, 25);
      doc.fontSize(9).font('Helvetica')
        .text(`${index + 1}. ${item.title} - ${item.quarter} - Owner: IT Team`);
      doc.moveDown(0.3);
    });

    doc.moveDown(3);

    // Sign-off
    doc.fontSize(10).font('Helvetica-Bold').text('Client Sign-Off');
    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica')
      .text('Signature: ___________________________   Date: __________');

    doc.moveDown(3);
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#95a5a6')
      .text('Generated by ETop AM Intelligence System', { align: 'center' });
  }

  renderSectionHeader(doc, title) {
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#2c3e50').text(title);
    doc.moveDown(1);
    doc.font('Helvetica').fillColor('#34495e');
  }

  drawGauge(doc, x, y, score, label, color) {
    doc.save();
    doc.circle(x, y, 35).lineWidth(6).strokeColor('#ecf0f1').stroke();
    doc.circle(x, y, 35).lineWidth(6).strokeColor(color).stroke();
    doc.fontSize(18).font('Helvetica-Bold').fillColor(color)
      .text(score.toString(), x - 20, y - 10, { width: 40, align: 'center' });
    doc.fontSize(10).fillColor('#2c3e50')
      .text(label, x - 40, y + 45, { width: 80, align: 'center' });
    doc.restore();
  }

  async generateBarChart(labels, data) {
    const config = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: '#3498db',
          borderColor: '#2980b9',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    };
    return await this.chartRenderer.renderToBuffer(config);
  }

  async generatePieChart(labels, data, colors) {
    const config = {
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
        responsive: false,
        plugins: { legend: { position: 'bottom' } }
      }
    };
    return await this.chartRenderer.renderToBuffer(config);
  }

  async generateRadarChart(labels, data) {
    const config = {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          borderColor: 'rgba(52, 152, 219, 1)',
          pointBackgroundColor: 'rgba(52, 152, 219, 1)'
        }]
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false } },
        scales: { r: { beginAtZero: true, max: 100 } }
      }
    };
    return await this.chartRenderer.renderToBuffer(config);
  }
}

module.exports = ProductionPDFGenerator;
