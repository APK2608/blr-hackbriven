/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const RISK_REGISTRY: Record<string, number> = {
  read_codebase: 1,
  modify_auth_module: 4,
  run_tests: 2,
  deploy_staging: 5,
  push_to_production: 9,
  drop_database: 10,
  delete_records: 9,
  access_customer_data: 8,
  search_flights: 1,
  search_hotels: 1,
  create_itinerary: 2,
  book_ticket: 7,
  send_payment: 9,
  read_files: 1,
  write_report: 2,
};

export const HIGH_RISK_THRESHOLD = 7;

export const BACKEND_BASE_URL = 'https://intent-firewall.onrender.com';

export const SAMPLE_GOALS = [
  'Fix the login authentication bug in our application.',
  'Analyze flight options and book the cheapest ticket to Seattle.',
  'Generate a security report and write to the report directory.',
  'Migrate customer transactions and delete the legacy tables.',
];

// Map internal tool name to a friendly readable action
export function getFriendlyActionName(toolName: string, args?: Record<string, any>): string {
  const fileInfo = args?.filepath ? ` on '${args.filepath}'` : '';
  const schemaInfo = args?.schema ? ` on schema '${args.schema}'` : '';
  const amtInfo = args?.amount ? ` ($${args.amount})` : '';
  
  switch (toolName) {
    case 'read_codebase':
      return `Read source codebase directory${fileInfo}`;
    case 'modify_auth_module':
      return `Modify application security authentication module${fileInfo}`;
    case 'run_tests':
      return `Run unit and integration test suite`;
    case 'deploy_staging':
      return `Deploy updated artifacts to staging environment`;
    case 'push_to_production':
      return `Push critical repository master branch to production cluster`;
    case 'drop_database':
      return `Executed destructive SQL command drop_database()${schemaInfo}`;
    case 'delete_records':
      return `Executed DELETE operations on customer tables`;
    case 'access_customer_data':
      return `Access raw customer PII database`;
    case 'search_flights':
      return `Authorized search_flights API call`;
    case 'search_hotels':
      return `Authorized search_hotels API call`;
    case 'create_itinerary':
      return `Created draft travel itinerary document`;
    case 'book_ticket':
      return `Purchased airfare transit ticket`;
    case 'send_payment':
      return `Disbursed third-party financial wire payment${amtInfo}`;
    case 'read_files':
      return `Read local configuration files${fileInfo}`;
    case 'write_report':
      return `Compile and write system executive summary report`;
    default:
      return `Execute tool call: ${toolName}`;
  }
}
