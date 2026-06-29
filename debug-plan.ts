// debug-plan.ts
import fetch from 'node-fetch';

async function main() {
  const url = 'https://intent-firewall.onrender.com';
  
  console.log('--- Creating Plan ---');
  const res = await fetch(url + '/create-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_input: 'Fix the login authentication bug in our application.' })
  });
  const body: any = await res.json();
  console.log('Create Plan:', body);

  const planId = body.plan_id;
  if (!planId) {
    console.log('No plan_id returned');
    return;
  }

  // Check intent-details
  const resDetails = await fetch(`${url}/intent-details/${planId}`);
  console.log('Intent details status:', resDetails.status);
  console.log('Intent details:', await resDetails.text());

  // Let's see if we can call execute with exactly the schema fields
  const executePayloads = [
    { plan_id: planId, tool_name: 'read_codebase', arguments: {} },
    { plan_id: planId, tool_name: 'modify_auth_module', arguments: {} },
    { plan_id: planId, tool_name: 'run_tests', arguments: {} },
    { plan_id: planId, tool_name: 'deploy_staging', arguments: {} },
    { plan_id: planId, tool_name: 'drop_database', arguments: {} }
  ];

  for (const payload of executePayloads) {
    const resExec = await fetch(url + '/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`Execute ${payload.tool_name} status:`, resExec.status);
    console.log(`Execute ${payload.tool_name} body:`, await resExec.text());
  }
}

main();
