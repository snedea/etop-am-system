const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/db');

async function seedMockData() {
  console.log('🌱 Seeding mock data...\n');

  try {
    // 1. Create a sample client
    const [client] = await db('clients')
      .insert({
        external_id: 'acme-001',
        source: 'connectwise',
        name: 'Acme Corporation',
        segment: 'A',
        mrr: 5000.00,
        agreement_start: '2025-01-01',
        agreement_end: '2026-01-01'
      })
      .returning('*');

    console.log('✅ Created client:', client.name);

    // 2. Create sites
    const [site] = await db('sites')
      .insert({
        client_id: client.id,
        external_id: 'acme-hq',
        name: 'Headquarters',
        address: '123 Main St, Austin, TX'
      })
      .returning('*');

    console.log('✅ Created site:', site.name);

    // 3. Create contacts
    await db('contacts').insert([
      {
        client_id: client.id,
        external_id: 'contact-1',
        role: 'CEO',
        email: 'john@acmecorp.com',
        phone: '555-0100'
      },
      {
        client_id: client.id,
        external_id: 'contact-2',
        role: 'IT Manager',
        email: 'jane@acmecorp.com',
        phone: '555-0101'
      }
    ]);

    console.log('✅ Created 2 contacts');

    // 4. Create users
    await db('users').insert([
      {
        client_id: client.id,
        external_id: 'user-1',
        email: 'john@acmecorp.com',
        upn: 'john@acmecorp.com',
        mfa_enabled: true,
        risk_level: 'low'
      },
      {
        client_id: client.id,
        external_id: 'user-2',
        email: 'jane@acmecorp.com',
        upn: 'jane@acmecorp.com',
        mfa_enabled: false,
        risk_level: 'medium'
      }
    ]);

    console.log('✅ Created 2 users');

    // 5. Create devices
    await db('devices').insert([
      {
        client_id: client.id,
        site_id: site.id,
        external_id: 'device-1',
        name: 'ACME-WKS-001',
        type: 'endpoint',
        os: 'Windows 11 Pro',
        managed: true,
        health_status: 'healthy'
      },
      {
        client_id: client.id,
        site_id: site.id,
        external_id: 'device-2',
        name: 'ACME-WKS-002',
        type: 'endpoint',
        os: 'Windows 10 Pro',
        managed: true,
        health_status: 'warning'
      },
      {
        client_id: client.id,
        site_id: site.id,
        external_id: 'device-3',
        name: 'ACME-SRV-001',
        type: 'server',
        os: 'Windows Server 2022',
        managed: true,
        health_status: 'healthy'
      }
    ]);

    console.log('✅ Created 3 devices');

    // 6. Create agreement
    await db('agreements').insert({
      client_id: client.id,
      external_id: 'agreement-1',
      mrr: 5000.00,
      effective_rate: 150.00,
      term_months: 12
    });

    console.log('✅ Created agreement');

    // 7. Create tickets
    await db('tickets').insert([
      {
        client_id: client.id,
        external_id: 'ticket-1',
        category: 'Network',
        priority: 'high',
        status: 'closed',
        hours_spent: 2.5,
        sla_met: true,
        reopen_count: 0
      },
      {
        client_id: client.id,
        external_id: 'ticket-2',
        category: 'Email',
        priority: 'medium',
        status: 'closed',
        hours_spent: 1.0,
        sla_met: true,
        reopen_count: 1
      },
      {
        client_id: client.id,
        external_id: 'ticket-3',
        category: 'Password Reset',
        priority: 'low',
        status: 'closed',
        hours_spent: 0.25,
        sla_met: true,
        reopen_count: 0
      }
    ]);

    console.log('✅ Created 3 tickets');

    // 8. Create controls
    await db('controls').insert([
      {
        client_id: client.id,
        external_id: 'control-1',
        control_type: 'patch_compliance',
        status: 'pass',
        evidence: { message: 'All critical patches installed' },
        last_checked: new Date()
      },
      {
        client_id: client.id,
        external_id: 'control-2',
        control_type: 'edr_coverage',
        status: 'pass',
        evidence: { message: '100% endpoint coverage' },
        last_checked: new Date()
      },
      {
        client_id: client.id,
        external_id: 'control-3',
        control_type: 'mfa_enabled',
        status: 'fail',
        evidence: { message: '1 user without MFA' },
        last_checked: new Date()
      }
    ]);

    console.log('✅ Created 3 controls');

    // 9. Create risks
    await db('risks').insert([
      {
        client_id: client.id,
        external_id: 'risk-1',
        risk_type: 'identity',
        title: 'MFA Not Enabled',
        likelihood: 'medium',
        impact: 'high',
        status: 'open',
        description: 'User without MFA detected. Enable MFA for all users to reduce identity-based attack risk.'
      },
      {
        client_id: client.id,
        external_id: 'risk-2',
        risk_type: 'endpoint',
        title: 'Device Health Warning',
        likelihood: 'low',
        impact: 'medium',
        status: 'open',
        description: '1 device with health warnings. Investigate device health alerts to prevent potential failures.'
      }
    ]);

    console.log('✅ Created 2 risks');

    // 10. Create recommendations
    await db('recommendations').insert([
      {
        client_id: client.id,
        title: 'Implement MFA for all users',
        description: 'Enable multi-factor authentication across the organization to reduce identity-based attacks',
        effort: 'low',
        cost_range: '$0-$500',
        priority: 'high',
        quarter: 'Q1'
      },
      {
        client_id: client.id,
        title: 'Upgrade Windows 10 devices',
        description: 'Plan migration from Windows 10 to Windows 11 before EOL',
        effort: 'medium',
        cost_range: '$1000-$2500',
        priority: 'medium',
        quarter: 'Q2'
      },
      {
        client_id: client.id,
        title: 'Implement endpoint backup solution',
        description: 'Add workstation backup coverage for critical user data',
        effort: 'medium',
        cost_range: '$500-$1500',
        priority: 'medium',
        quarter: 'Q2'
      }
    ]);

    console.log('✅ Created 3 recommendations');

    console.log('\n✅ Mock data seeded successfully!');
    console.log(`\nClient ID: ${client.id}`);
    console.log(`Client Name: ${client.name}`);
    console.log(`\nYou can now generate a QBR with:`);
    console.log(`curl -X POST http://localhost:3000/clients/${client.id}/qbr/generate \\`);
    console.log(`  -H "Authorization: Bearer your-api-key"`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedMockData();
