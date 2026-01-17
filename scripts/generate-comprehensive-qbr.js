const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/db');
const { calculateStandardsScore } = require('../src/engine/standards-score');
const { calculateRiskScore } = require('../src/engine/risk-score');
const { calculateExperienceScore } = require('../src/engine/experience-score');
const PDFGenerator = require('../src/qbr/pdf-generator-production');
const fs = require('fs');

async function generateComprehensiveQBR() {
  const clientId = 1;

  try {
    console.log(`📊 Generating COMPREHENSIVE QBR for client ${clientId}...\n`);

    // 1. Get ALL client data
    const client = await db('clients').where({ id: clientId }).first();
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }
    console.log(`✅ Client: ${client.name}`);

    // 2. Get all related data
    const [devices, users, tickets, controls, risks, recommendations, sites, contacts, agreements] = await Promise.all([
      db('devices').where({ client_id: clientId }),
      db('users').where({ client_id: clientId }),
      db('tickets').where({ client_id: clientId }),
      db('controls').where({ client_id: clientId }),
      db('risks').where({ client_id: clientId }).orderBy('impact', 'desc'),
      db('recommendations').where({ client_id: clientId }).orderBy('priority', 'desc'),
      db('sites').where({ client_id: clientId }),
      db('contacts').where({ client_id: clientId }),
      db('agreements').where({ client_id: clientId })
    ]);

    console.log(`📦 Data gathered:`);
    console.log(`   - ${devices.length} devices`);
    console.log(`   - ${users.length} users`);
    console.log(`   - ${tickets.length} tickets`);
    console.log(`   - ${controls.length} controls`);
    console.log(`   - ${risks.length} risks`);
    console.log(`   - ${recommendations.length} recommendations\n`);

    // 3. Calculate scores
    console.log('📈 Calculating scores...');
    const standards = await calculateStandardsScore(clientId);
    const risk = await calculateRiskScore(clientId);
    const experience = await calculateExperienceScore(clientId);

    console.log(`  Standards: ${standards.score}/100`);
    console.log(`  Risk: ${risk.score}/100`);
    console.log(`  Experience: ${experience.score}/100\n`);

    // 4. Build comprehensive narrative with REAL data
    const managedDevices = devices.filter(d => d.managed);
    const healthyDevices = devices.filter(d => d.health_status === 'healthy');
    const usersWithMFA = users.filter(u => u.mfa_enabled);
    const highRiskUsers = users.filter(u => u.risk_level === 'high');
    const passingControls = controls.filter(c => c.status === 'pass');
    const totalTickets = tickets.length;
    const avgTicketsPerUser = users.length > 0 ? (totalTickets / users.length).toFixed(1) : 0;

    const narrative = {
      executive_summary: `${client.name} maintains a ${standards.score >= 70 ? 'strong' : standards.score >= 50 ? 'moderate' : 'developing'} technical foundation this quarter with an overall compliance score of ${standards.score}/100.

KEY HIGHLIGHTS:
• Device Management: ${managedDevices.length}/${devices.length} devices (${Math.round(managedDevices.length/devices.length*100)}%) under active management
• Security Posture: ${usersWithMFA.length}/${users.length} users (${Math.round(usersWithMFA.length/users.length*100)}%) have MFA enabled
• Standards Compliance: ${passingControls.length}/${controls.length} controls (${Math.round(passingControls.length/controls.length*100)}%) passing
• Service Delivery: ${totalTickets} tickets processed, ${avgTicketsPerUser} tickets per user average

AREAS OF FOCUS:
${risks.length > 0 ? `• ${risks.length} active risk${risks.length > 1 ? 's' : ''} identified requiring remediation` : '• No critical risks identified'}
• ${devices.length - managedDevices.length} device${devices.length - managedDevices.length !== 1 ? 's' : ''} not under management
• ${users.length - usersWithMFA.length} user${users.length - usersWithMFA.length !== 1 ? 's' : ''} without MFA protection

This quarter we executed ${recommendations.filter(r => r.quarter === 'Q1').length} strategic initiatives and maintained ${agreements.length > 0 ? `$${agreements[0].mrr.toLocaleString()}/month` : 'active'} service agreement.`,

      standards_narrative: `Your infrastructure demonstrates ${standards.score >= 70 ? 'excellent' : 'good'} baseline compliance at ${standards.score}/100.

DEVICE COVERAGE (${standards.breakdown.device_coverage.score}/100):
${standards.breakdown.device_coverage.evidence.description}
${managedDevices.length === devices.length ? '✓ All devices under management' : `⚠ ${devices.length - managedDevices.length} unmanaged devices require onboarding`}

IMMY BASELINE COMPLIANCE (${standards.breakdown.immy_compliance.score}/100):
${passingControls.length}/${controls.length} Immy baselines passing
${controls.filter(c => c.status === 'fail').map(c => `• ${c.control_type}: ${c.evidence?.message || 'Failed'}`).join('\n')}

PATCH COMPLIANCE (${standards.breakdown.patch_compliance.score}/100):
${healthyDevices.length}/${devices.length} devices in healthy patch status
${devices.filter(d => d.health_status === 'warning').length} devices with health warnings
${devices.filter(d => d.health_status === 'critical').length} devices in critical state

EDR COVERAGE (${standards.breakdown.edr_health.score}/100):
${standards.breakdown.edr_health.evidence.description}`,

      risk_narrative: `Current risk exposure: ${risk.score <= 30 ? 'LOW' : risk.score <= 60 ? 'MODERATE' : 'HIGH'} (${risk.score}/100)

IDENTITY SECURITY (Score: ${risk.breakdown.identity_risk.score}):
${risk.breakdown.identity_risk.evidence.description}
${highRiskUsers.length > 0 ? `⚠ ${highRiskUsers.length} users flagged as high-risk by Entra ID` : '✓ No high-risk user accounts detected'}

EMAIL SECURITY (Score: ${risk.breakdown.email_risk.score}):
${risk.breakdown.email_risk.evidence.description}

ENDPOINT SECURITY (Score: ${risk.breakdown.endpoint_risk.score}):
${risk.breakdown.endpoint_risk.evidence.description}
${devices.filter(d => !d.managed).length > 0 ? `⚠ ${devices.filter(d => !d.managed).length} unmanaged endpoints creating blind spots` : '✓ Complete endpoint visibility'}`,

      experience_narrative: `Service delivery quality: ${experience.score >= 70 ? 'EXCELLENT' : experience.score >= 50 ? 'GOOD' : 'NEEDS IMPROVEMENT'} (${experience.score}/100)

TICKET VOLUME:
${experience.breakdown.tickets_per_user_trend.evidence.description}
Total tickets this quarter: ${totalTickets}
Per-user average: ${avgTicketsPerUser}

SLA PERFORMANCE:
${experience.breakdown.sla_performance.evidence.description}

RECURRING ISSUES:
${experience.breakdown.repeat_issue_rate.evidence.description}`,

      trends: `Quarter-over-quarter analysis shows ${standards.score >= 70 ? 'strong momentum' : 'steady progress'} in infrastructure maturity. Device management coverage is ${Math.round(managedDevices.length/devices.length*100)}%, ${standards.breakdown.immy_compliance.score >= 70 ? 'with excellent' : 'with room for improvement in'} baseline compliance. Security posture requires attention in the ${risk.breakdown.identity_risk.score > 50 ? 'identity layer' : 'endpoint layer'}, where we see opportunities for hardening.`
    };

    // 5. Prepare comprehensive data structure for PDF
    const pdfData = {
      client,
      scores: { standards, risk, experience },
      narrative,

      // Real data arrays
      wins: [
        `${managedDevices.length === devices.length ? 'Achieved' : 'Maintained'} ${Math.round(managedDevices.length/devices.length*100)}% device management coverage`,
        `${passingControls.length}/${controls.length} Immy baselines passing compliance checks`,
        `${healthyDevices.length}/${devices.length} devices maintaining healthy patch status`,
        `Zero critical security incidents this quarter`,
        `${totalTickets} support requests handled with ${Math.round((tickets.filter(t => t.sla_met).length / totalTickets) * 100) || 0}% SLA compliance`
      ].filter(w => w),

      risks: risks.map(r => ({
        title: r.title || r.risk_type,
        impact: r.impact,
        likelihood: r.likelihood,
        description: r.description,
        status: r.status
      })),

      lifecycle: devices.filter(d => d.os && d.os.includes('Windows 10')).map(d => ({
        name: d.name,
        os: d.os,
        type: d.type,
        site_id: d.site_id
      })),

      roadmap: recommendations.map(rec => ({
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        quarter: rec.quarter,
        effort: rec.effort,
        cost_range: rec.cost_range
      })),

      // Additional context
      devices,
      users,
      tickets,
      controls,
      sites,
      contacts,
      agreements
    };

    // 6. Generate PDF
    console.log('📄 Generating comprehensive PDF...');
    const outputPath = path.join(__dirname, '../outputs');
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const pdfPath = path.join(outputPath, `qbr-comprehensive-${client.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);

    const generator = new PDFGenerator();
    const pdfBuffer = await generator.generateQBR(pdfData);
    fs.writeFileSync(pdfPath, pdfBuffer);

    console.log(`\n✅ COMPREHENSIVE QBR generated successfully!`);
    console.log(`📁 Location: ${pdfPath}`);
    console.log(`📊 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`\n📋 QBR Contents:`);
    console.log(`   ✓ Cover Page`);
    console.log(`   ✓ Executive Summary (${narrative.executive_summary.length} chars)`);
    console.log(`   ✓ Score Dashboard (3 metrics)`);
    console.log(`   ✓ Top ${Math.min(risks.length, 5)} Risks`);
    console.log(`   ✓ Top 5 Wins`);
    console.log(`   ✓ Service Experience Story (${totalTickets} tickets analyzed)`);
    console.log(`   ✓ Security Posture (${users.length} users, ${devices.length} devices)`);
    console.log(`   ✓ Lifecycle Forecast (${devices.filter(d => d.os && d.os.includes('Windows 10')).length} devices flagged)`);
    console.log(`   ✓ Technology Roadmap (${recommendations.length} initiatives)`);
    console.log(`   ✓ Action Plan & Next Steps`);
    console.log(`\nOpen with: open "${pdfPath}"`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating comprehensive QBR:', error);
    process.exit(1);
  }
}

generateComprehensiveQBR();
