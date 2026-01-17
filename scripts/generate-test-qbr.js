const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/db');
const { calculateStandardsScore } = require('../src/engine/standards-score');
const { calculateRiskScore } = require('../src/engine/risk-score');
const { calculateExperienceScore } = require('../src/engine/experience-score');
const PDFGenerator = require('../src/qbr/pdf-generator');
const fs = require('fs');

async function generateTestQBR() {
  const clientId = 1;

  try {
    console.log(`📊 Generating test QBR for client ${clientId}...\n`);

    // 1. Get client data
    const client = await db('clients').where({ id: clientId }).first();
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }
    console.log(`✅ Client: ${client.name}`);

    // 2. Calculate scores
    console.log('📈 Calculating scores...');
    const standards = await calculateStandardsScore(clientId);
    const risk = await calculateRiskScore(clientId);
    const experience = await calculateExperienceScore(clientId);

    console.log(`  Standards: ${standards.score}/100`);
    console.log(`  Risk: ${risk.score}/100`);
    console.log(`  Experience: ${experience.score}/100\n`);

    // 3. Create static narrative (no OpenAI)
    const narrative = {
      executive_summary: `Acme Corporation maintains a solid technical foundation with ${standards.score}/100 compliance score. Key strengths include 100% device coverage and EDR deployment. Primary risk areas center on identity security, with 50% of users lacking MFA enforcement.

This quarter we addressed ${await db('tickets').where({ client_id: clientId }).count('* as count').then(r => r[0].count)} service requests with high SLA performance. Two security risks remain open and should be prioritized for Q1 remediation.`,

      standards_narrative: `Your infrastructure maintains strong baseline compliance at ${standards.score}/100. All devices are under active management with consistent EDR coverage. ${standards.breakdown.immy_compliance.evidence.passed_controls} of ${standards.breakdown.immy_compliance.evidence.total_controls} Immy baselines are passing, indicating room for standardization improvements.`,

      risk_narrative: `Current risk exposure is LOW TO MODERATE (${risk.score}/100). Identity security is the primary concern: ${risk.breakdown.identity_risk.evidence.mfa_coverage}% MFA coverage leaves accounts vulnerable to credential-based attacks. No critical endpoint or email threats are active.`,

      experience_narrative: `Service delivery remains stable. Ticket volume per user is well-controlled, and SLA performance meets expectations. No significant recurring issues detected this quarter.`,

      top_risks: [
        {
          title: 'MFA Not Enabled',
          impact: 'High',
          description: '50% of users lack MFA, creating identity attack surface',
          recommendation: 'Enforce conditional access policies requiring MFA for all cloud applications'
        },
        {
          title: 'Device Health Warning',
          impact: 'Medium',
          description: 'One workstation showing health alerts',
          recommendation: 'Schedule maintenance window to address device warnings'
        }
      ],

      top_wins: [
        '100% device coverage - all endpoints under management',
        '100% EDR deployment across environment',
        'All critical patches current on managed devices',
        'Zero high-severity security alerts this quarter'
      ],

      recommendations: [
        {
          title: 'Implement MFA for all users',
          description: 'Enable multi-factor authentication across the organization to reduce identity-based attacks',
          effort: 'Low',
          cost_range: '$0-$500',
          priority: 'High',
          quarter: 'Q1',
          outcome: 'Reduce identity attack surface by 80%'
        },
        {
          title: 'Upgrade Windows 10 devices',
          description: 'Plan migration from Windows 10 to Windows 11 before EOL',
          effort: 'Medium',
          cost_range: '$1000-$2500',
          priority: 'Medium',
          quarter: 'Q2',
          outcome: 'Ensure continued OS support and security updates'
        }
      ],

      roadmap: {
        q1: ['Implement MFA enforcement', 'Address device health warnings'],
        q2: ['Windows 11 migration planning', 'Endpoint backup implementation'],
        q3: ['Security awareness training program'],
        q4: ['Annual security assessment']
      },

      lifecycle_forecast: [
        {
          category: 'Workstations',
          current_count: 2,
          aging_out_12mo: 0,
          aging_out_24mo: 1,
          estimated_cost: '$1,500'
        },
        {
          category: 'Servers',
          current_count: 1,
          aging_out_12mo: 0,
          aging_out_24mo: 0,
          estimated_cost: '$0'
        }
      ]
    };

    // 4. Generate PDF
    console.log('📄 Generating PDF...');
    const outputPath = path.join(__dirname, '../outputs');
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const pdfPath = path.join(outputPath, `qbr-client-${clientId}-${Date.now()}.pdf`);

    const pdfData = {
      client,
      scores: { standards, risk, experience },
      narrative
    };

    const generator = new PDFGenerator();
    const pdfBuffer = await generator.generateQBR(pdfData);
    fs.writeFileSync(pdfPath, pdfBuffer);

    console.log(`\n✅ QBR PDF generated successfully!`);
    console.log(`📁 Location: ${pdfPath}`);
    console.log(`\nOpen it with: open "${pdfPath}"`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating QBR:', error);
    process.exit(1);
  }
}

generateTestQBR();
