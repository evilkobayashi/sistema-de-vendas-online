import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/app.ts');
let content = fs.readFileSync(file, 'utf8');

// The functions that need to be awaited
const dbFunctions = [
  'listCustomers', 'getCustomerById', 'createCustomer', 'updateCustomer',
  'listDoctors', 'getDoctorById', 'createDoctor', 'updateDoctor',
  'listHealthPlans', 'getHealthPlanById', 'createHealthPlan', 'updateHealthPlan',
  'createPatientActivity', 'listPatientActivities',
  'listEmployees', 'createEmployee',
  'listSuppliers', 'createSupplier',
  'listFinishedProducts', 'createFinishedProduct',
  'listRawMaterials', 'createRawMaterial',
  'listStandardFormulas', 'createStandardFormula',
  'listPackagingFormulas', 'createPackagingFormula'
];

for (const fn of dbFunctions) {
  // Regex to match calling the function
  // e.g. listCustomers(...) -> await listCustomers(...)
  const regex = new RegExp(`(?<!await\\s)\\b${fn}\\(`, 'g');
  content = content.replace(regex, `await ${fn}(`);
}

// Ensure the endpoints containing 'await' are marked as async
const endpointsRegex = /(app\.(get|post|patch|put|delete)\(['"][^'"]+['"],\s*(?:authRequired,\s*)?(?:authorize\([^)]+\),\s*)?)\((req[^)]*)\)\s*=>/g;
content = content.replace(endpointsRegex, (match, prefix, method, reqArgs) => {
  return `${prefix}async (${reqArgs}) =>`;
});

// Also fix `validatePatientReferences` manually
content = content.replace(/function validatePatientReferences/g, 'async function validatePatientReferences');
content = content.replace(/validatePatientReferences\(/g, 'await validatePatientReferences(');

// Also fix `logPatientActivity` manually
content = content.replace(/function logPatientActivity/g, 'async function logPatientActivity');
content = content.replace(/logPatientActivity\(/g, 'await logPatientActivity(');


// Write JWT replacement
content = content.replace(/import crypto from 'node:crypto';/, `import crypto from 'node:crypto';\nimport jwt from 'jsonwebtoken';\nimport bcrypt from 'bcrypt';`);
content = content.replace(/const SESSION_TTL_MS = 8 \* 60 \* 60 \* 1000;/, `const SESSION_TTL_MS = 8 * 60 * 60 * 1000;\nconst JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';`);
content = content.replace(/sessions\.set\(token,\s*{\s*user:\s*safeUser,\s*expiresAt[^\}]+\}\);/, `const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '8h' });`);
content = content.replace(/const token = createToken\(\);/, '');

const authRequiredCode = `
function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Omit<User, 'password'>;
    (req as AuthenticatedRequest).authUser = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}
`;

// Replace `authRequired`
content = content.replace(/function authRequired\([\s\S]+?return next\(\);\s*\}/, authRequiredCode);

// Write changes
fs.writeFileSync(file, content);
console.log('App.ts refactored!');
