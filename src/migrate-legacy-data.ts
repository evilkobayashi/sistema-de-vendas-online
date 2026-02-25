import {
  createDoctor,
  createHealthPlan,
  initDatabase,
  listCustomers,
  listDoctors,
  listHealthPlans,
  updateCustomer
} from './database.js';

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function makeLegacyCrm(customerId: string) {
  return `LEGACY-${customerId.slice(-8).toUpperCase()}`;
}

function makeLegacyPlanReg(customerId: string) {
  return `LEGACY-PLAN-${customerId.slice(-8).toUpperCase()}`;
}

async function main() {
  initDatabase();

  const customers = listCustomers();
  let migrated = 0;
  let createdDoctors = 0;
  let createdPlans = 0;

  for (const customer of customers) {
    let doctorId = customer.doctorId;
    let healthPlanId = customer.healthPlanId;

    if (!doctorId) {
      const doctors = listDoctors();
      const legacyDoctorName = (customer.primaryDoctorId || '').trim();
      const matchedDoctor = doctors.find((d) => {
        if (!legacyDoctorName) return false;
        const n = normalize(legacyDoctorName);
        return normalize(d.id) === n || normalize(d.crm) === n || normalize(d.name) === n;
      });

      if (matchedDoctor) {
        doctorId = matchedDoctor.id;
      } else {
        const created = createDoctor({
          name: legacyDoctorName || `Médico legado ${customer.name}`,
          crm: makeLegacyCrm(customer.id),
          specialty: 'Legado',
          email: customer.email,
          phone: customer.phone
        });
        doctorId = created.id;
        createdDoctors += 1;
      }
    }

    if (!healthPlanId) {
      const plans = listHealthPlans();
      const legacyPlanName = (customer.insurancePlanName || '').trim();
      const legacyProvider = (customer.insuranceProviderName || '').trim() || 'Operadora Legado';
      const matchedPlan = plans.find((p) => {
        if (!legacyPlanName) return false;
        return normalize(p.name) === normalize(legacyPlanName) && normalize(p.providerName) === normalize(legacyProvider);
      });

      if (matchedPlan) {
        healthPlanId = matchedPlan.id;
      } else {
        const created = createHealthPlan({
          name: legacyPlanName || 'Plano Legado',
          providerName: legacyProvider,
          registrationCode: makeLegacyPlanReg(customer.id)
        });
        healthPlanId = created.id;
        createdPlans += 1;
      }
    }

    if (doctorId !== customer.doctorId || healthPlanId !== customer.healthPlanId) {
      updateCustomer(customer.id, {
        ...customer,
        doctorId,
        healthPlanId
      });
      migrated += 1;
    }
  }

  console.log(JSON.stringify({ scanned: customers.length, migrated, createdDoctors, createdPlans }, null, 2));
}

main().catch((error) => {
  console.error('Legacy migration failed:', error);
  process.exitCode = 1;
});
